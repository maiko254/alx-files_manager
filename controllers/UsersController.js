import sha1 from 'sha1';
import dbClient from '../utils/db';

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
      const record = await usersCollection.findOne({ email, password: sha1Password });
      if (record) {
        return res.status(400).json({ error: 'Already exist' });
      }
      const result = await usersCollection.insertOne({ email, password: sha1Password });
      return res.status(201).json({ id: result.insertedId, email });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
}

export default UsersController;
