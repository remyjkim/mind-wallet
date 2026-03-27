import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'architecture',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/quickstart',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      items: [
        'packages/core',
        'packages/protocols',
        'packages/discovery',
        'packages/cli',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/private-key-wallet',
        'guides/env-vars',
        'guides/policy-rules',
      ],
    },
  ],
};

export default sidebars;
