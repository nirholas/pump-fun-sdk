import { readFileSync, writeFileSync } from 'node:fs';

export const readJSON = (filePath) => {
  const data = readFileSync(filePath, 'utf8');
  return JSON.parse(data);
};

export const writeJSON = (filePath, data) => {
  const jsonStr = JSON.stringify(data, null, 2);
  writeFileSync(filePath, jsonStr, 'utf8');
};

export const getDomainFromUrl = (url) => {
  const withoutProtocol = url.replace(/^https?:\/\//, '');
  const domain = withoutProtocol.split('/')[0];
  return 'https://' + domain.split(':')[0];
};

export const getAuthor = (url) => {
  const withoutProtocol = url.replace(/^https?:\/\//, '');
  const domain = withoutProtocol.split('/')[0];
  const domains = domain.split(':')[0].split('.');
  if (domains[1] === 'vercel') return domains[0];
  return domains.length > 2 ? domains[1] : domains[0];
};
