import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const auth = req.get('Authorization');
    if (!auth) return res.status(401).send({ error: 'Unauthorized' });
    const buff = Buffer.from(auth.replace('Basic ', ''), 'base64').toString('utf-8');
    const [email, password] = buff.split(':');
    if (!email || !password) return res.status(401).send({ error: 'Unauthorized' });
    const hashedPassword = sha1(password);

    try {
      const userCollection = await dbClient.getCollection('users');
      const user = await userCollection.findOne({ email, password: hashedPassword });

      if (!user) return res.status(401).send({ error: 'Unauthorized' });

      const token = uuidv4();
      const key = `auth_${token}`;
      await redisClient.set(key, user._id.toString(), 86400);

      return res.status(200).send({ token });
    } catch (err) {
      console.log(err);
      return res.status(500).send({ error: err.message });
    }
  }

  static async getDisconnect(req, res) {
    const token = req.get('X-Token');
    if (!token) return res.status(401).send({ error: 'Unauthorized' });
    try {
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).send({ error: 'Unauthorized' });
      await redisClient.del(key);
      return res.status(204).send();
    } catch (err) {
      return res.status(500).send({ error: err.message });
    }
  }
}

export default AuthController;
