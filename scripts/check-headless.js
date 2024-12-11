   // scripts/check-headless.js
   const { execSync } = require('child_process');

   try {
     const result = execSync('git diff --cached', { encoding: 'utf-8' });
     if (result.includes('headless: false')) {
       console.error('Error: Commit contains "headless: false".');
       process.exit(1);
     }
     console.log('No "headless: false" found in commit.');
   } catch (error) {
     console.error('Error checking for "headless: false":', error);
     process.exit(1);
   }