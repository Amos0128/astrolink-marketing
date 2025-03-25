const puppeteer = require('puppeteer-firefox');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function main() {
  // Create a new profile directory in the project for Firefox
  const userDataDir = path.join(process.cwd(), 'firefox-profile');
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('Firefox profile directory:', userDataDir);

  try {
    const browser = await puppeteer.launch({
      headless: false,
      userDataDir: userDataDir,
      defaultViewport: null,
      args: ['--window-size=1920,1080']
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
  
    // Add additional headers and permissions
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    try {
      // First navigate to the main Prime Video page
      await page.goto('https://www.amazon.com/Prime-Video/b?node=2676882011', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Handle any potential redirects or login requirements
      const currentUrl = page.url();
      if (currentUrl.includes('signin')) {
        console.log('Login required - please sign in manually');
        // Wait for navigation after login
        await page.waitForNavigation({ 
          waitUntil: 'networkidle0',
          timeout: 60000 
        });
      }

      // After login, wait a bit for the page to stabilize
      await page.waitForTimeout(3000);

      // Now try to navigate to the specific video (if needed)
      await page.goto('https://www.amazon.com/Prime-Video/b?node=2676882011', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

    } catch (error) {
      console.error('Navigation error:', error);
    }

  } catch (error) {
    console.error('Browser launch error:', error);
    if (error.message.includes('EACCES')) {
      console.error('Permission denied. Try running with sudo or check directory permissions.');
    }
    throw error;
  }

  await new Promise(resolve => setTimeout(resolve, 100000000000));
}

main().catch(error => {
  console.error('Main error:', error);
  process.exit(1);
});