const puppeteer = require('puppeteer');

humanType = async (page, selector, genText) => {
  // Focus on the input field
  await page.click(selector);

  // Use Array.from to correctly handle emojis and surrogate pairs
  const characters = Array.from(genText);

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    console.log('Typing character:', char);

    // Check if the character is an emoji or special character (non-ASCII)
    if (char.match(/[\u{1F600}-\u{1F6FF}]/u) || char.match(/[^\x00-\x7F]/)) {
      // Use page.type for emojis and other non-ASCII characters
      const emojiDelay = Math.random() * 1000 + 500;
      await page.waitForTimeout(emojiDelay);
      await page.type(selector, char);
    } else {
      // Use keyboard.press for normal characters
      if (char === ' ') {
        await page.keyboard.press('Space'); // Handle spaces explicitly
      } else if (char === char.toUpperCase() && char.match(/[a-zA-Z]/)) {
        await page.keyboard.down('Shift'); // Hold down Shift for capital letters
        await page.keyboard.press(char); // Press the capital letter
        await page.keyboard.up('Shift'); // Release Shift
      } else {
        await page.keyboard.press(char); // Press lowercase letters and other symbols
      }
    }

    // Randomly vary typing speed to mimic human behavior
    const typingSpeed = Math.random() * 250 + 50;
    await page.waitForTimeout(typingSpeed);

    // Randomly add "thinking pauses" after some words
    if (char === ' ' && Math.random() < 0.2) {
      const thinkingPause = Math.random() * 1500 + 500;
      await page.waitForTimeout(thinkingPause);
    }

    // Randomly simulate small typing errors and corrections
    if (Math.random() < 0.08) {
      // 8% chance of error
      const errorChar = String.fromCharCode(
        Math.floor(Math.random() * 26) + 97,
      ); // Random lowercase letter
      await page.keyboard.type(errorChar); // Type incorrect character
      await page.waitForTimeout(typingSpeed / 0.8); // Short delay after mistake
      await page.keyboard.press('Backspace'); // Correct the mistake
    }

    // Randomly add a longer pause to mimic thinking (more rarely)
    if (Math.random() < 0.1) {
      const longPause = Math.random() * 2000 + 500;
      await page.waitForTimeout(longPause);
    }
  }

  // Extra delay after finishing typing to simulate human thinking or reviewing
  const finishDelay = Math.random() * 2000 + 1000;
  console.log(
    `Finished typing. Waiting for additional mouse delay of ${finishDelay} ms`,
  );

  // Simulate random mouse movement during the pause
  await page.waitForTimeout(finishDelay);
};

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.google.com/'); // Replace with the URL of the website you want to test

  // Example selector for an input field (change as needed)
  await page.waitForSelector('textarea[name="q"]'); // Replace with the actual selector of the input field
  const selector = 'textarea[name="q"]'; // Replace with the actual selector of the input field

  const genText = 'Hello 🌍! Testing emoji typing 😊'; // Test string including emojis

  await humanType(page, selector, genText);

  // Wait for a while to see the result
  await page.waitForTimeout(5000); // Adjust the timeout for testing

  await browser.close();
})();
