import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  static getStatus(req, res) {
    const dbStatus = dbClient.isAlive();
    const redisStatus = redisClient.isAlive();

    res.status(200).send({ redis: redisStatus, db: dbStatus });
  }

  static async getStats(req, res) {
    const userCount = await dbClient.nbUsers();
    const fileCount = await dbClient.nbFiles();

    res.status(200).send({ users: userCount, files: fileCount });
  }
}

export default AppController;
