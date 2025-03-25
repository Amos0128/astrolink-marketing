const puppeteer = require('puppeteer-core');
const PCR = require('puppeteer-chromium-resolver');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function main() {
  const stats = await PCR();
  
  // Create a new profile directory in the project
  const userDataDir = path.join(process.cwd(), 'chrome-profile');
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('Chrome profile directory:', userDataDir);
  console.log('Chrome executable path:', stats.executablePath);

  try {
    const browser = await puppeteer.launch({
      executablePath: stats.executablePath,
      // headless: false,
      userDataDir: userDataDir,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--autoplay-policy=no-user-gesture-required',
        '--enable-usermedia-screen-capturing',
        '--allow-running-insecure-content',
        '--unsafely-treat-insecure-origin-as-secure',
        '--enable-features=MediaEngagementBypassAutoplayPolicies',
        '--enable-widevine',
        '--no-user-gesture-required'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
  
    // Set proper user agent
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  
    // Add additional headers and permissions
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Origin': 'https://www.primevideo.com',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'https://www.primevideo.com',
      'Content-Type': 'application/json'
    });

    // Add more detailed browser fingerprinting and DRM handling
    await page.evaluateOnNewDocument(() => {
      // Mock WebDriver
      delete navigator.__proto__.webdriver;

      // Enhanced fingerprinting protection
      const originalGetParameter = HTMLMediaElement.prototype.getVideoPlaybackQuality;
      Object.defineProperty(HTMLMediaElement.prototype, 'getVideoPlaybackQuality', {
        writable: false,
        enumerable: true,
        configurable: true,
        value: function() {
          return {
            totalVideoFrames: 1000,
            droppedVideoFrames: 0,
            corruptedVideoFrames: 0,
            creationTime: performance.now(),
            totalFrameDelay: 0
          };
        }
      });

      // Mock DRM capabilities
      if (navigator.mediaCapabilities) {
        const originalDecodingInfo = navigator.mediaCapabilities.decodingInfo;
        navigator.mediaCapabilities.decodingInfo = async (config) => {
          const result = await originalDecodingInfo.call(navigator.mediaCapabilities, config);
          return {
            ...result,
            supported: true,
            smooth: true,
            powerEfficient: true
          };
        };
      }

      // Modify navigator properties
      const modifyNavigator = {
        platform: 'Linux x86_64',
        plugins: {
          length: 5,
          refresh: function(){},
          item: function(){},
          namedItem: function(){}
        },
        mimeTypes: {
          length: 2,
          item: function(){},
          namedItem: function(){}
        }
      };

      Object.defineProperties(navigator, {
        platform: {get: () => modifyNavigator.platform},
        plugins: {get: () => modifyNavigator.plugins},
        mimeTypes: {get: () => modifyNavigator.mimeTypes}
      });
    });

    // Add required cookies and storage handling
    await page.evaluateOnNewDocument(() => {
      // Mock localStorage for Prime Video
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        if (key.includes('minerva') || key.includes('prime')) {
          // Allow Prime Video related storage
          return originalSetItem.call(this, key, value);
        }
      };

      // Enhanced media capabilities
      window.MediaKeys = class MediaKeys {
        constructor() {
          this.sessionTypes = ['temporary', 'persistent-license'];
        }
        createSession() {
          return {
            generateRequest: () => Promise.resolve(),
            update: () => Promise.resolve(),
            close: () => Promise.resolve(),
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
          };
        }
      };
    });

    // Set additional required headers
    await page.setExtraHTTPHeaders({
      ...page._client._extraHeaders,
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="131", "Chromium";v="131"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Linux"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site'
    });

    // Add DRM handling script
    await page.evaluateOnNewDocument(() => {
      // Mock EME (Encrypted Media Extensions) APIs
      if (!window.navigator.requestMediaKeySystemAccess) {
        window.navigator.requestMediaKeySystemAccess = async (keySystem, configs) => {
          // Simulate Widevine support
          if (keySystem === 'com.widevine.alpha') {
            return Promise.resolve({
              keySystem: keySystem,
              createMediaKeys: () => Promise.resolve(new MediaKeys())
            });
          }
          return Promise.reject('Unsupported keySystem');
        };
      }
    });

    // Set permissions to allow media playback
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.primevideo.com/', [
      'microphone',
      'camera',
      'notifications'
    ]);

    // Add script to mask WebDriver
    await page.evaluateOnNewDocument(() => {
      delete navigator.__proto__.webdriver;
      // Overwrite the `navigator.mediaDevices.getUserMedia`
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    try {
      await page.goto('https://www.primevideo.com/region/na/detail/0HAQAA7JM43QWX0H6GUD3IOF70/ref=atv_hm_hom_c_ywRzEs_brws_2_18?jic=8%7CEgRzdm9k', {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Take screenshot after initial load
      await page.screenshot({
        path: './screenshots/initial-load.png',
        fullPage: true
      });

      // Handle any potential redirects or login requirements
      const currentUrl = page.url();
      if (currentUrl.includes('signin')) {
        console.log('Login page detected - taking screenshot');
        await page.screenshot({
          path: './screenshots/login-page.png',
          fullPage: true
        });
      }

      // Wait for video player element and take screenshot
      try {
        await page.waitForSelector('.webPlayerElement', { timeout: 10000 });
        console.log('Video player found - taking screenshot');
        await page.screenshot({
          path: './screenshots/video-player.png',
          fullPage: true
        });
      } catch (error) {
        console.log('Video player not found - taking error state screenshot');
        await page.screenshot({
          path: './screenshots/no-player.png',
          fullPage: true
        });
      }

      // Log the page HTML for debugging
      const pageContent = await page.content();
      console.log('Page HTML length:', pageContent.length);
      
      // Log any console messages
      page.on('console', msg => {
        console.log('Browser console:', msg.text());
      });

    } catch (error) {
      console.error('Navigation error:', error);
      // Take screenshot of error state
      await page.screenshot({
        path: './screenshots/error-state.png',
        fullPage: true
      });
    }

  } catch (error) {
    console.error('Browser launch error:', error);
    // Print more detailed error information
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