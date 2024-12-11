   // scripts/check-headless.js
   const { execSync } = require('child_process');

   try {
     const result = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
     const jsTsFiles = result.split('\n').filter(file => 
       (file.endsWith('.js') || file.endsWith('.ts')) && file !== 'scripts/check-headless.js'
     );

     jsTsFiles.forEach(file => {
       const fileDiff = execSync(`git diff --cached ${file}`, { encoding: 'utf-8' });
       const headlessRegex = /headless\s*:\s*false/;
       if (headlessRegex.test(fileDiff)) {
         console.error(`Error: Commit contains "headless: false" in ${file}.`);
         process.exit(1);
       }
     });
   } catch (error) {
     console.error('Error checking for "headless: false":', error);
     process.exit(1);
   }