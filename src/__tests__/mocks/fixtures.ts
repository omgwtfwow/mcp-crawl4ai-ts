export const fixtures = {
  crawlPage: {
    success: {
      markdown: '# Example Domain\n\nThis domain is for use in illustrative examples in documents.',
      links: {
        internal: ['/about', '/contact'],
        external: ['https://iana.org'],
      },
      metadata: {
        title: 'Example Domain',
        description: 'Example Domain for documentation',
      },
    },
    withScreenshot: {
      markdown: '# Example Domain\n\nThis domain is for use in illustrative examples in documents.',
      screenshot:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    },
  },
  getMarkdown: {
    success: {
      url: 'https://example.com',
      filter: 'fit',
      query: null,
      cache: '0',
      markdown: '# Example Domain\n\nThis domain is for use in illustrative examples in documents.',
      success: true,
    },
    rawFilter: {
      url: 'https://example.com',
      filter: 'raw',
      query: null,
      cache: '0',
      markdown: '# Example Domain\n\nRaw markdown content including all elements.',
      success: true,
    },
    bm25Filter: {
      url: 'https://example.com',
      filter: 'bm25',
      query: 'example domain',
      cache: '0',
      markdown: '# Example Domain\n\nFiltered content based on BM25 search.',
      success: true,
    },
    llmFilter: {
      url: 'https://example.com',
      filter: 'llm',
      query: 'What is this page about?',
      cache: '0',
      markdown: 'This page is about Example Domain, used for illustrative examples.',
      success: true,
    },
  },
  screenshot: {
    success: {
      success: true,
      screenshot:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    },
  },
  pdf: {
    success: {
      success: true,
      pdf: 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nGVOuwoCMRBF',
    },
  },
  html: {
    success: {
      html: '<!DOCTYPE html><html><head><title>Example Domain</title></head><body><h1>Example Domain</h1></body></html>',
    },
  },
  batch: {
    success: {
      results: [
        { url: 'https://example.com', success: true, markdown: '# Example' },
        { url: 'https://example.org', success: true, markdown: '# Example Org' },
      ],
    },
  },
  sitemap: {
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
  </url>
  <url>
    <loc>https://example.com/about</loc>
  </url>
  <url>
    <loc>https://example.com/contact</loc>
  </url>
</urlset>`,
  },
  errors: {
    notFound: {
      response: {
        status: 404,
        data: { detail: 'Page not found' },
      },
    },
    serverError: {
      response: {
        status: 500,
        data: { detail: 'Internal server error' },
      },
    },
    networkError: {
      code: 'ECONNREFUSED',
      message: 'Connection refused',
    },
  },
};
