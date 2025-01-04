import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: 'BBiuw3VphV0E4ySIQxm7rJKqo6cxJYZX',
    socket: {
        host: 'redis-18572.c100.us-east-1-4.ec2.redns.redis-cloud.com',
        port: 18572
    }
});

client.on('error', err => console.log('Redis Client Error', err));

client.on('connect', () => console.log('Redis Client Connected'));

await client.connect();

export default client;