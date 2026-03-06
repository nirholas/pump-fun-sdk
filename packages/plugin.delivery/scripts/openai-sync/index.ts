import { consola } from 'consola';
import { load } from 'js-yaml';
import { merge } from 'lodash';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pMap from 'p-map';
import sharp from 'sharp';
import urlJoin from 'url-join';

import { BASE_URL, pluginDir } from './const';
import data from './syncList';
import { getAuthor, getDomainFromUrl, readJSON, writeJSON } from './utils';

export interface PluginMainifest {
  api: {
    url: string;
  };
  auth: {
    type: 'none' | string;
  };
  description_for_human: string;
  description_for_model: string;
  legal_info_url: string;
  logo_url: string;
  name_for_human: string;
  name_for_model: string;
}

const run = async () => {
  let expireList: string[] = [];
  const list = await pMap(
    data,
    async ({ manifest, path, tags, overrides = {}, author, homepage }) => {
      consola.start(path);
      const dirPath = resolve(pluginDir, path);
      try {
        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }
        const manifestRes = await fetch(manifest);
        let manifestJson: PluginMainifest = await manifestRes.json();
        if (!manifestJson) return;

        if (overrides?.manifest) {
          manifestJson = merge(manifestJson, overrides.manifest);
        }

        const apiRes = await fetch(manifestJson.api.url);
        const isJSON = manifestJson.api.url.includes('.json');
        const apiFilename = 'openapi.json';

        let apiJson;
        if (isJSON) {
          apiJson = await apiRes.json();
        } else {
          const apiYaml = await apiRes.text();
          apiJson = load(apiYaml);
        }

        if (!apiJson?.servers || apiJson?.servers?.length === 0) {
          apiJson.servers = [
            {
              url: 'https://' + manifestJson.api.url.split('/')[2],
            },
          ];
        }

        if (overrides?.openapi) {
          apiJson = merge(apiJson, overrides.openapi);
        }

        writeJSON(resolve(dirPath, apiFilename), apiJson);

        const logoName = resolve(dirPath, `logo.webp`);

        if (!existsSync(logoName)) {
          const logoRes = await fetch(manifestJson.logo_url);
          if (logoRes.ok) {
            const blob = await logoRes.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const image = sharp(buffer);
            await image.resize(512, 512).webp().toFile(logoName);
            writeFileSync(logoName, buffer);
          }
        }

        manifestJson.api.url = urlJoin(BASE_URL, path, apiFilename);
        manifestJson.logo_url = urlJoin(BASE_URL, path, `logo.webp`);
        writeJSON(resolve(dirPath, 'manifest.json'), manifestJson);

        consola.success(`Synced ${path}`);

        return {
          author: author || getAuthor(manifest),
          homepage: homepage || getDomainFromUrl(manifest),
          identifier: manifestJson.name_for_model,
          manifest: urlJoin(BASE_URL, path, 'manifest.json'),
          meta: {
            avatar: manifestJson.logo_url,
            description: manifestJson.description_for_human,
            tags: tags,
            title: manifestJson.name_for_human,
          },
          schemaVersion: 1
        };
      } catch (error) {
        consola.error(`Failed to sync ${path}`, error);
        const cachePath = resolve(dirPath, 'manifest.json');
        if (!existsSync(cachePath)) return;
        const cacheManifest: PluginMainifest = readJSON(resolve(dirPath, 'manifest.json'));
        expireList.push(cacheManifest.name_for_model);
        consola.warn(`Add ${path} to expire list`);
      }
    },
    { concurrency: 5 },
  );

  writeJSON(resolve(pluginDir, 'index.json'), {
    expires: expireList,
    plugins: list.filter(Boolean),
  });
};

run();
