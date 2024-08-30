import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const sha1Password = sha1(password);

    try {
      const usersCollection = await dbClient.getCollection('users');
      const record = await usersCollection.findOne({ email: email });

      if (record) {
        return res.status(400).json({ error: 'Already exist' });
      }

      const result = await usersCollection.insertOne({ email, password: sha1Password });

      return res.status(201).json({ id: result.insertedId, email });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async getMe(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const userId = await redisClient.get(`auth_${token}`);

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const usersCollection = await dbClient.getCollection('users');
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });

      if (!user) return res.status(500).json({ error: 'Unauthorized' });

      return res.status(200).json({ id: user._id, email: user.email });
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
  }
}

export default UsersController;
