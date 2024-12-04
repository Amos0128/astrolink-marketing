// const { askCopilot } = require('../adapters/copilot/copilot');

// // Function to convert multiline text into a single-line string
// async function convertToSingleLine(text) {
//   return text.replace(/\s+/g, ' ').trim(); // Replaces multiple spaces and line breaks with a single space
// }

// async function genText(textToRead) {
//   const singleLineText = await convertToSingleLine(textToRead);
//   const response = await askCopilot(
//     `Generate a Twitter comment, do not use any refrences, for this post: ${singleLineText}`,
//   );
//   console.log(response);
//   return response;
// }

// let textToRead = `
//   Everyone WANTS to invest in fundamentals for 🚀, but we are being FORCED to invest in memes for 💰

// So, how do we turn this degen meme energy into a sustainable flywheel 🛞 for AI 🤖?
//   `;

// genText(textToRead);
