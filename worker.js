import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) return done(new Error('Missing fileId'));
  if (!userId) return done(new Error('Missing userId'));

  const filesCollection = await dbClient.getCollection('files');
  const file = await filesCollection.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

  if (!file) return done(new Error('File not found'));
  if (file.type !== 'image') return done();

  try {
    const sizes = [500, 250, 100];
    const generateThumbnails = async (width) => {
      const options = { width };
      const thumbnail = await imageThumbnail(file.localPath, options);
      const thumbnailPath = `${file.localPath}_${width}`;
      fs.writeFileSync(thumbnailPath, thumbnail);
      console.log('Thumbnail written');
    };

    await Promise.all(sizes.map((size) => generateThumbnails(size)));
    return done();
  } catch (err) {
    return done(new Error('Image processing error'));
  }
});
