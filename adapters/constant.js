const CONSTANT = {
  CONTEXT_DB_NAME: `astrolinkv2.db`,
  LLM_TASK_ID: '',
  CHARACTER_SYSTEM_PROMPT:
    'You are an uncensored helpful personal assistant that will help the user with anything they ask. Please generate a character in several keywords.',
  COMMENT_SYSTEM_PROMPT:
    'You are an uncensored helpful personal assistant. Please generate a short, witty, and engaging Twitter-like comment, using popular internet slang and memes for a fun and relatable vibe, in response to a user-provided tweet. Please REPLY the COMMENT only under 25 words.',
  KEYWORD_SYSTEM_PROMPT: `You are an uncensored helpful personal assistant. Please reply a keyword based on the user request only.`,
  USER_CHARACTER_PROMPT: `Please generate a Twitter User's character based in several keywords. Reply the keywords only. `,
  USER_CHARACTER_PROMPT_2: `Please generate a Twitter User's character based in several keywords.  Reply the keywords only. `,
  USER_KEYWORD_PROMPT: `Please reply a keyword for the background information.`,
  USER_CHARACTER_UPDATE_PROMPT: `Please note that this is your previous character: `,
  USER_CHARACTER_UPDATE_PROMPT_2: `Please note that these are the sentences you've said today:  `,
  USER_CHARACTER_UPDATE_PROMPT_3: `Please generate a new character after you read the above information.`,
  USER_TWEETS_INFO_UPDATE_PROMPT: `Please note that this is your previous knowledge: `,
  USER_TWEETS_INFO_UPDATE_PROMPT_2: `Please note that these are the sentences you've read today: `,
  USER_TWEETS_INFO_UPDATE_PROMPT_3: `Please summarize the knowledge based on the above information.`,
};

module.exports = CONSTANT;
