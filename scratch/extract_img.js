async function check() {
  const res = await fetch('https://kommodo.ai/i/SssZD7VcuGiu7WXq1bK6');
  const html = await res.text();
  
  // Find all URLs in html that end in .png, .jpg, .jpeg, .webp or match cdn/media/storage
  const regex = /https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp)/gi;
  const matches = [...new Set(html.match(regex) || [])];
  console.log('Found image matches:', matches);
  
  // Also look for og:image or twitter:image
  const og = html.match(/og:image[^>]+content=["']([^"']+)["']/i) || html.match(/content=["']([^"']+)["'][^>]+og:image/i);
  console.log('OG image:', og ? og[1] : null);
  
  // Look for video or screenshot url
  const anyUrl = html.match(/https:\/\/[^"']+(?:s3|amazonaws|komodo|storage)[^"']+/gi);
  console.log('Storage matches:', anyUrl ? anyUrl.slice(0, 10) : null);
}

check();
