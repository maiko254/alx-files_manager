import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.isConnected = false;

    this.client
      .on('connect', () => {
        console.log('Redis client connected');
        this.isConnected = true;
      })
      .on('error', (err) => {
        console.log(`Redis client error ${err.message}`);
        this.isConnected = false;
      })
      .on('end', () => {
        console.log('Redis client disconnected');
        this.isConnected = false;
      });
  }

  isAlive() {
    return this.isConnected;
  }

  async get(key) {
    return promisify(this.client.get).bind(this.client)(key);
  }

  async set(key, value, duration) {
    return promisify(this.client.setex).bind(this.client)(key, duration, value);
  }

  async del(key) {
    return promisify(this.client.del).bind(this.client)(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
