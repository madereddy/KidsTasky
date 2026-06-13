import http from 'http';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = `${APP_URL}/api/health`;

async function checkHealth() {
  console.log(`Checking health at ${HEALTH_ENDPOINT}...`);
  
  return new Promise((resolve, reject) => {
    http.get(HEALTH_ENDPOINT, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.status === 'ok') {
              console.log('✅ Health check passed!');
              console.log(`   Database: ${json.database.status}`);
              console.log(`   Worker: ${json.worker.status}`);
              resolve(true);
            } else {
              console.error('❌ Health check returned non-ok status:', json);
              resolve(false);
            }
          } catch (e) {
            console.error('❌ Failed to parse health check response:', data);
            resolve(false);
          }
        } else {
          console.error(`❌ Health check failed with status code ${res.statusCode}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error('❌ Failed to connect to server:', err.message);
      resolve(false);
    });
  });
}

checkHealth().then((passed) => {
  process.exit(passed ? 0 : 1);
});
