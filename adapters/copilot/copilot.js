// const PCR = require('puppeteer-chromium-resolver');

// async function askCopilot(question) {
//   try{
//     const options = {};
//     const stats = await PCR(options);
//     const browser = await stats.puppeteer.launch({
//     executablePath: stats.executablePath,
//     // headless: false,
//     userAgent:
//       'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
//     args: [
//       '--aggressive-cache-discard',
//       '--disable-cache',
//       '--disable-application-cache',
//       '--disable-offline-load-stale-cache',
//       '--disable-gpu-shader-disk-cache',
//       '--no-sandbox',
//       '--disable-setuid-sandbox',
//       '--disable-gpu',
//       '--disable-dev-shm-usage',
//     ],
//   });

//   // Set viewport
//   const page = await browser.newPage();
//   await page.setViewport({ width: 1280, height: 800 }); // You can adjust the size as needed

//   // Go to ChatGPT
//   await page.goto('https://copilot.microsoft.com/');

//   // Wait for the page to load
//   await page.waitForTimeout(5000);

//   // Directly move the mouse and click based on known coordinates
//   const x = 560 + (720 - 560) / 2; // Center X
//   const y = 688 + (744 - 688) / 2; // Center Y

//   // Move the mouse to the button and click
//   await page.mouse.move(x, y);
//   await page.mouse.down();
//   await page.mouse.up();

//   console.log(`Mouse moved to coordinates (${x}, ${y}) and clicked.`);

//   // Wait 5 seconds before closing
//   await page.waitForTimeout(5000);

//   // Input First Name
//   const nameInput = await page.waitForSelector('textarea#userInput');
//   await nameInput.type('Ben');
//   // Wait 5 seconds
//   await page.waitForTimeout(1000);

//   // Simulate hitting "Enter" key
//   await page.keyboard.press('Enter');
//   // Wait 5 seconds
//   await page.waitForTimeout(3000);

//   // Simulate hitting "Tab" key
//   for (let i = 0; i < 5; i++) {
//     await page.keyboard.press('Tab');
//     await page.waitForTimeout(200);
//   }
//   console.log('Hit Tab key');
//   // Simulate hitting "Enter" key
//   await page.keyboard.press('Enter');

//   // Wait 5 seconds
//   await page.waitForTimeout(3000);
//   // Input Question in Text Area
//   const questionInput = await page.waitForSelector('textarea#userInput');
//   await questionInput.type(question);
//   // Wait 5 seconds
//   await page.waitForTimeout(3000);

//   // Simulate hitting "Enter" key
//   await page.keyboard.press('Enter');

//   // Wait 5 seconds
//   await page.waitForTimeout(5000);
//   // Retrieve Answer
//   const textContent = await page.evaluate(() => {
//     const element = document.querySelector('div[data-content="ai-message"] p');
//     return element ? element.innerText : null;
//   });

//     await page.waitForTimeout(2000);
//     await browser.close();
//     return textContent;
//   } catch (e) {
//     return '';
//   }
// }

// module.exports = { askCopilot };
