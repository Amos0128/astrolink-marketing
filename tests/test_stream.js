const PCR = require('puppeteer-chromium-resolver');

(async () => {
  let page;
  const options = {
    revision: '1394457', // Specify the desired Chromium revision, different OS have different revisions
    forceDownload: true, // Force download to ensure the correct version
    detectionPath: '', // Default detection path
    folderName: '.chromium-browser', // Optional folder name for Chromium
  };

  // Fetch stats for Chromium
  const stats = await PCR(options);
  console.log(`Using Chromium Revision: ${stats.revision}`);
  console.log(`Chromium Path: ${stats.executablePath}`);

  // Launch Puppeteer with the resolved Chromium
  const browser = await stats.puppeteer
    .launch({
      // headless: false,
      args: ['--no-sandbox'],
      executablePath: stats.executablePath,
    })
    .catch(function (error) {
      console.error('Error launching browser:', error);
    });

  page = await browser.newPage();

  // Set the European User-Agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; de-DE) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  );

  console.log('Go to page');

  await page.goto('https://www.ritestream.io/tv/5WJWhX5H0CjUcKYfwSHpY8', { // Stream URL
    waitUntil: 'networkidle2',
  });

  console.log('Page loaded successfully');
})();
