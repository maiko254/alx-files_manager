import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const userCollection = await dbClient.getCollection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    const {
      name, type, parentId, isPublic, data,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) return res.status(400).json({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });

    const filesCollection = await dbClient.getCollection('files');
    if (parentId && parentId !== 0) {
      const parentFile = await filesCollection.findOne({ _id: ObjectId(parentId) });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const newFile = {
      userId: user._id,
      name,
      type,
      parentId: parentId || 0,
      isPublic: isPublic || false,
    };
    if (type === 'folder') {
      await filesCollection.insertOne(newFile);
      return res.status(201).json(newFile);
    }

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');
    const path = `${folderPath}/${uuidv4()}`;
    const buff = Buffer.from(data, 'base64');

    try {
      fs.writeFileSync(path, buff);

      newFile.localPath = path;

      const result = await filesCollection.insertOne(newFile);
      newFile._id = result.insertedId;

      if (newFile.type === 'image') {
        fileQueue.add({
          userId: newFile.userId,
          fileId: newFile._id,
        });
      }
      return res.status(201).json(newFile);
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const userCollection = await dbClient.getCollection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    const fileId = req.params.id;
    if (!fileId) return res.status(400).json({ error: 'Not found' });

    const filesCollection = await dbClient.getCollection('files');
    const file = await filesCollection.findOne({ _id: ObjectId(fileId) });
    if (!file || file.userId.toString() !== user._id.toString() || fileId !== file._id.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const userCollection = await dbClient.getCollection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    const parentId = req.query.parentId || 0;
    const page = req.query.page || 0;
    const filesCollection = await dbClient.getCollection('files');
    const file = await filesCollection.findOne({ _id: ObjectId(parentId) });
    if (file && file.userId.toString() !== user._id.toString()) {
      return res.json({});
    }
    const pipeline = [
      { $match: { parentId, userId: user._id } },
      { $skip: page * 20 },
      { $limit: 20 },
    ];

    const files = await filesCollection.aggregate(pipeline).toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const userCollection = await dbClient.getCollection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    const fileId = req.params.id;
    if (!fileId) return res.status(400).json({ error: 'Not found' });

    const filesCollection = await dbClient.getCollection('files');
    const file = await filesCollection.findOne({ _id: ObjectId(fileId) });
    if (!file || file.userId.toString() !== user._id.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    await filesCollection.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });
    const updatedFile = await filesCollection.findOne({ _id: ObjectId(fileId) });
    return res.status(200).json(updatedFile);
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const userCollection = await dbClient.getCollection('users');
    const user = await userCollection.findOne({ _id: ObjectId(userId) });

    const fileId = req.params.id;
    if (!fileId) return res.status(400).json({ error: 'Not found' });

    const filesCollection = await dbClient.getCollection('files');
    const file = await filesCollection.findOne({ _id: ObjectId(fileId) });
    if (!file || file.userId.toString() !== user._id.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    await filesCollection.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });
    const updatedFile = await filesCollection.findOne({ _id: ObjectId(fileId) });
    return res.status(200).json(updatedFile);
  }

  static async getFile(req, res) {
    const { id: fileId } = req.params;
    const { size } = req.query;

    const filesCollection = await dbClient.getCollection('files');
    const file = await filesCollection.findOne({ _id: ObjectId(fileId) });

    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.isPublic === false) return res.status(404).json({ error: 'Not found' });
    if (file.type === 'folder') return res.status(400).json({ error: 'A folder doesn\'t have content' });

    let filePath = file.localPath;
    if (size) {
      if (![500, 250, 100].includes(parseInt(size, 10))) {
        return res.status(400).json({ error: 'Invalid size' });
      }
      filePath = `${file.localPath}_${size}`;
    }

    return fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) return res.status(404).json({ error: 'Not found' });
      const mimeType = mime.lookup(file.name);
      res.setHeader('Content-Type', mimeType);
      return fs.readFile(filePath, (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.status(200).send(data);
      });
    });
  }
}

export default FilesController;
