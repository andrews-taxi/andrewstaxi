#!/usr/bin/env node
/**
 * scripts/post-to-buffer.js
 * Posts to social media using Buffer API.
 */
const BUFFER_API_URL = 'https://api.buffer.com';
const SITE_URL = (process.env.SITE_URL || 'https://www.andrewstaxi.com').replace(/\/$/, '');

// Replace these with the actual channel IDs for the taxi service
const CHANNELS = {
  facebook: '6abcb11eea19ca0bde2f8f2e',
  threads: '6abd4446ea19ca0bde35ec09',
};

async function bufferRequest(token, query, variables) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors && body.errors.length > 0) throw new Error(body.errors.map(e => e.message).join('; '));
  return body.data;
}

async function waitForDeployment(url, maxRetries = 40, delayMs = 10000) {
  console.log(`Waiting for ${url} to become available...`);
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Use a cache-busting query parameter to avoid cached 404s
      const checkUrl = `${url}?_t=${Date.now()}`;
      const res = await fetch(checkUrl, { method: 'HEAD' });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        const isImageRequest = url.match(/\.(png|jpg|jpeg|gif|webp)$/i);
        if (isImageRequest && !contentType.startsWith('image/')) {
          console.log(`Got 200 OK, but content-type is ${contentType} (expected image/). Still waiting...`);
        } else {
          console.log(`URL is live after ${i * (delayMs / 1000)} seconds.`);
          return true;
        }
      }
    } catch (e) {
      // Ignore network errors during polling
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  console.log(`Timeout waiting for ${url}`);
  return false;
}

const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id } }
      ... on MutationError { message }
    }
  }
`;

async function postToChannel(token, { channelId, label, text, imageUrl, metadata }) {
  if (channelId.includes('REPLACE')) return false; // Skip unconfigured channels
  const input = {
    text, channelId, schedulingType: 'automatic', mode: 'shareNow',
    assets: imageUrl ? [{ image: { url: imageUrl } }] : [],
    ...(metadata && { metadata })
  };
  try {
    const data = await bufferRequest(token, CREATE_POST_MUTATION, { input });
    if (data.createPost?.message) {
      console.warn(`${label}: ${data.createPost.message}`);
      return false;
    }
    console.log(`${label}: queued successfully.`);
    return true;
  } catch (error) {
    console.warn(`${label}: ${error.message}`);
    return false;
  }
}

async function main() {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) return console.error('BUFFER_ACCESS_TOKEN not set.');

  const slug = process.env.POST_SLUG || '';
  const title = process.env.POST_TITLE || '';
  const excerpt = process.env.POST_EXCERPT || '';
  const image = process.env.POST_IMAGE || '';

  if (!slug || !title) return console.log('No post generated.');

  const postUrl = `${SITE_URL}/blog/${slug}`;
  let imageUrl = image ? `${SITE_URL}${image}` : '';

  console.log(`Posting to socials: ${postUrl}`);
  
  if (imageUrl) {
    await waitForDeployment(imageUrl);
  } else {
    await waitForDeployment(postUrl);
  }

  const hashtags = process.env.POST_HASHTAGS || '';
  const postText = hashtags 
    ? `${title}\n\n${excerpt}\n\n${hashtags}\n\nRead more: ${postUrl}`
    : `${title}\n\n${excerpt}\n\nRead more: ${postUrl}`;

  // Facebook: deactivated per user instruction
  // await postToChannel(token, {
  //   channelId: CHANNELS.facebook,
  //   label: 'Facebook',
  //   text: postText,
  //   imageUrl,
  //   metadata: { facebook: { type: 'post' } },
  // });

  // Threads: active
  await postToChannel(token, {
    channelId: CHANNELS.threads,
    label: 'Threads',
    text: postText,
    imageUrl,
  });


}

// PAUSED: Commented out while daily blog generation is paused
// main().catch(e => console.error(e));
