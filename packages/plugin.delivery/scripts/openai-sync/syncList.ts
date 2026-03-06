interface PluginItem {
  author?: string;
  homepage?: string;
  manifest: string;
  overrides?: {
    manifest?: { [key: string]: any };
    openapi?: { [key: string]: any };
  };
  path: string;
  tags?: string[];
}
const PluginList: PluginItem[] = [
  {
    manifest: 'https://seo-plugin.orrenprunckun.com/.well-known/ai-plugin.json',
    path: 'seo',
    tags: ['seo'],
  },
  {
    manifest: 'https://savvytrader.com/.well-known/ai-plugin.json',
    path: 'savvy-trader',
    tags: ['stock', 'analyze'],
  },
  {
    manifest: 'https://plugin.askyourpdf.com/.well-known/ai-plugin.json',
    path: 'ask-your-pdf',
    tags: ['pdf', 'document', 'web'],
  },
  {
    manifest: 'https://assetovi.com/.well-known/ai-plugin.json',
    path: 'asset-ovi',
    tags: ['3-d', 'assets', 'search'],
  },
  {
    manifest: 'https://chat-plugin-giphy.efficiency.tools/.well-known/ai-plugin.json',
    path: 'gif-search',
    tags: ['gif', 'image', 'search'],
  },
  {
    manifest: 'https://twitter.say-apps.com/.well-known/ai-plugin.json',
    path: 'social-search',
    tags: ['social', 'twitter', 'x', 'search'],
  },
  {
    manifest: 'https://stack-overflow-search.onrender.com/.well-known/ai-plugin.json',
    path: 'stackoverflow',
    tags: ['stack-overflow', 'q-a'],
  },
  {
    manifest: 'https://api.getchange.io/.well-known/ai-plugin.json',
    path: 'getchange',
    tags: ['charity'],
  },
  {
    manifest: 'https://cryptoplugin.feednews.com/.well-known/ai-plugin.json',
    path: 'token-insights',
    tags: ['crypto', 'BTC', 'ETH', 'BNB'],
  },
  {
    manifest: 'https://app.swap.net/.well-known/ai-plugin.json',
    path: 'nftguru',
    tags: ['crypto', 'NFT'],
  },
  {
    manifest: 'https://llamawrapper-prod.onrender.com/.well-known/ai-plugin.json',
    path: 'defillama',
    tags: ['crypto', 'DeFi'],
  },
  {
    manifest: 'https://search-ai.mintbase.xyz/.well-known/ai-plugin.json',
    path: 'mintbasesearch',
    tags: ['crypto', 'NFT'],
  },
  {
    manifest: 'https://speak.com/.well-known/ai-plugin.json',
    path: 'speak',
    tags: ['education', 'language'],
  },
  {
    manifest: 'https://openai.tapapis.com/.well-known/ai-plugin.json',
    path: 'game-sight',
    tags: ['game', 'search'],
  },
  {
    manifest: 'https://websearch.plugsugar.com/.well-known/ai-plugin.json',
    path: 'web-search',
    tags: ['search', 'plugsugar'],
  },
  {
    manifest: 'https://sheet-generator.brandzzy.com/.well-known/ai-plugin.json',
    path: 'make-a-sheet',
    tags: ['csv', 'excel', 'sheet'],
  },
  {
    manifest: 'https://showme.redstarplugin.com/.well-known/ai-plugin.json',
    path: 'diagrams-show-me',
    tags: ['diagrams'],
  },
  {
    manifest: 'https://chatgpt.boolio.co.kr/.well-known/ai-plugin.json',
    path: 'boolio',
    tags: ['stock', 'analyze'],
  },
  {
    manifest: 'https://api.360macky.com/.well-known/ai-plugin.json',
    path: 'astrodaily',
    tags: ['nasa', 'search', 'image'],
  },
  {
    author: 'steven-tey',
    homepage: 'https://github.com/steven-tey/weathergpt',
    manifest: 'https://weathergpt.vercel.app/.well-known/ai-plugin.json',
    path: 'weather-gpt',
    tags: ['weather'],
  },
  {
    author: 'yunwei37',
    homepage: 'https://github.com/yunwei37/ChatGPT-github-stat-plugin',
    manifest: 'https://chat-gpt-github-stat-plugin.vercel.app/.well-known/ai-plugin.json',
    path: 'github-stats',
    tags: ['github', 'oss'],
  },
  {
    manifest: 'https://chatgpt-plugin.questmate.com/.well-known/ai-plugin.json',
    path: 'questmate',
    tags: ['forms', 'checklists', 'productivity'],
  },
  {
    manifest: 'https://scholarly.maila.ai/.well-known/ai-plugin.json',
    path: 'scholarly',
    tags: ['scientific-literature', 'search'],
  },
  {
    manifest: 'https://api.litmaps.com/.well-known/ai-plugin.json',
    path: 'litmaps',
    tags: ['scientific-literature', 'search'],
  },
  {
    manifest: 'https://txyz.ai/.well-known/ai-plugin.json',
    path: 'txyz',
    tags: ['research-paper', 'search'],
  },
  {
    manifest: 'https://www.guruwalk.com/.well-known/ai-plugin.json',
    path: 'guru-walk',
    tags: ['travel', 'guides'],
  },
  {
    manifest: 'https://www.travelmyth.com/.well-known/ai-plugin.json',
    path: 'travelmyth',
    tags: ['travel', 'hotel', 'search'],
  },
  {
    manifest: 'https://earthquake.beta3.dev/.well-known/ai-plugin.json',
    path: 'earthquake',
    tags: ['earthquake', 'utilities'],
  },
  {
    manifest: 'https://gpt.domatron.com/.well-known/ai-plugin.json',
    path: 'domatron',
    tags: ['domain', 'search'],
  },
  {
    manifest: 'https://nba-gpt-prod.onrender.com/.well-known/ai-plugin.json',
    path: 'nba-stats',
    tags: ['sports', 'basketball', 'nba'],
  },
  {
    manifest: 'https://vcaption.maila.ai/.well-known/ai-plugin.json',
    path: 'video-captions',
    tags: ['video-to-text', 'youtube'],
  },
  {
    manifest: 'https://glarity.app/.well-known/ai-plugin.json',
    path: 'video-summary',
    tags: ['video-to-text', 'youtube'],
  },
  {
    manifest: 'https://sheets.accessplugins.com/.well-known/ai-plugin.json',
    path: 'access-google-sheets',
    tags: ['google', 'sheets', 'excel'],
  },
  {
    manifest: 'https://aladin-search-book.azurewebsites.net/.well-known/ai-plugin.json',
    path: 'aladin-search-book',
    tags: ['book', 'search'],
  },
  {
    manifest: 'https://api.prod.bardeen.ai/bot/static/ai-plugin.json',
    path: 'bardeen',
    tags: ['workflow', 'automatic'],
  },
  {
    manifest: 'https://api.pulsetic.com/.well-known/ai-plugin.json',
    path: 'uptime',
    tags: ['website', 'performance', 'test'],
  },
  {
    manifest: 'https://dmtoolkit.magejosh.repl.co/.well-known/ai-plugin.json',
    path: 'diceroller',
    tags: ['game', 'dice', 'dm'],
  },
  {
    manifest: 'https://app.filtir.com/.well-known/ai-plugin.json',
    path: 'factcheck',
    tags: ['check', 'fact'],
  },
  {
    manifest: 'https://imgser.aigenprompt.com/.well-known/ai-plugin.json',
    path: 'image-search',
    tags: ['image', 'search'],
  },
  {
    manifest: 'https://levinbot.customplugin.ai/.well-known/ai-plugin.json',
    path: 'levinbot',
    tags: ['research-paper', 'search'],
  },
  {
    manifest: 'https://podcasts.mixerbox.com/.well-known/ai-plugin.json',
    path: 'mixer-box-podcasts',
    tags: ['podcast', 'search'],
  },
  {
    manifest: 'https://translate.mixerbox.com/.well-known/ai-plugin.json',
    path: 'mixer-box-translate-ai-language-tutor',
    tags: ['translate'],
  },
  {
    manifest: 'https://weather.mixerbox.com/.well-known/ai-plugin.json',
    path: 'mixer-box-weather',
    tags: ['weather'],
  },
  {
    manifest: 'https://portfoliometa.com/.well-known/ai-plugin.json',
    path: 'stock-data',
    tags: ['stock'],
  },
  {
    manifest: 'https://webfx.ai/.well-known/ai-plugin.json',
    path: 'seo-assistant',
    tags: ['seo', 'keyword'],
  },
  {
    manifest: 'https://shoppingtools.biz/.well-known/ai-plugin.json',
    path: 'shopping-tools',
    tags: ['shopping', 'eBay', 'AliExpress', 'coupons'],
  },
  {
    manifest: 'https://space.automateyournetwork.ca/.well-known/ai-plugin.json',
    path: 'space',
    tags: ['space', 'nasa'],
  },
  {
    manifest: 'https://gptfineart.azurewebsites.net/static/ai-plugin.json',
    path: 'ssfineart',
    tags: ['art', 'fineart', 'search'],
  },
  {
    manifest: 'https://guitarchords.pluginboost.com/.well-known/ai-plugin.json',
    path: 'uberchord',
    tags: ['music', 'guitar', 'search'],
  },
  {
    manifest: 'https://medium.com/.well-known/ai-plugin.json',
    path: 'medium',
    tags: ['article', 'search'],
  },
  {
    manifest: 'https://mermaid.pyxl.uk/.well-known/ai-plugin.json',
    path: 'charts-and-diagrams',
    tags: ['chart', 'diagram'],   
  }
];

export default PluginList;
