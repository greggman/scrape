'use strict';

const makeOptions = require('optionator');
const jsdom = require("jsdom");
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const URL = require('url').URL;

const { JSDOM } = jsdom;

/* eslint-disable object-curly-newline */
const optionSpec = {
  options: [
    { option: 'help', alias: 'h', type: 'Boolean', description: 'displays help' },
    { option: 'dest-dir', type: 'String', description: 'destination path', },
  ],
  prepend: 'Usage: scrape [options] url1 [url2...]',
  helpStyle: {
    typeSeparator: '=',
    descriptionSeparator: ' : ',
    initialIndent: 4,
  },
};
/* eslint-enable object-curly-newline */
const optionator = makeOptions(optionSpec);

let args;
try {
  args = optionator.parse(process.argv);
} catch (e) {
  console.error(e);
  printHelp();
}

function printHelp() {
  console.log(optionator.generateHelp());
  process.exit(0);  // eslint-disable-line
}

if (args.help) {
  printHelp();
}

const mediaRE = /\.(?:webm|gif)$/i;
function isMediaUrl(url) {
  return mediaRE.test(url);
}

function getMediaName(str) {
  return isMediaUrl(str) ? str : undefined;
}

const badRE = /^[0-9]+\./
function goodName(str) {
  return str.replace(badRE, '');
}

const badCharRE = /[^-a-zA-Z0-9 \[\]\(\).]/g;
function safeName(str) {
  return str.replace(badCharRE, '_');
}

async function main(args) {
  for (const url of args._) {
    const res = await fetch(url);
    const body = await res.text();
    const urls = {};
    const dom = new JSDOM(body);
    [...dom.window.document.querySelectorAll("a")]
    .filter(a => isMediaUrl(a.href))
    .forEach((a) => {
      // try to figure out what name to save by
      // note we should probably check that "textContext" is not too long
      // should also use a heuristic of the 4 instead of the first one that exists
      const name = getMediaName(a.title) || getMediaName(a.alt) || getMediaName(a.textContent) || path.basename(a.href);
      const oldName = urls[a.href] || '';
      // don't download the same url twice
      urls[a.href] = goodName(name).length > goodName(oldName).length ? safeName(name) : oldName;
    });

    for (const [link, name] of Object.entries(urls)) {
      try {
        const fullUrl = new URL(link, url);
        const filename = path.join(args.destDir, name);
        console.log('downloading:', fullUrl.href, 'as', filename);
        const res = await fetch(fullUrl);
        const buffer = await res.buffer();
        fs.writeFileSync(filename, buffer);
      } catch (e) {
        console.error('error: could not fetch', link, e);
      }
    }
  }

  console.log('--done--');
}

main(args);

