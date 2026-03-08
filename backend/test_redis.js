const Redis = require('ioredis');
const redis = new Redis({
  host: 'redis-11801.crce179.ap-south-1-1.ec2.cloud.redislabs.com',
  port: 11801,
  username: 'default',
  password: 'ZytgpWDhcFeosIzeheccQsRj4Sq1BOqx'
});
redis.get('analytics:trends:12').then(v => {
  console.log('Cached:', v);
  redis.quit();
}).catch(console.error);
