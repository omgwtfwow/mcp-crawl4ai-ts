import { jest } from '@jest/globals';

// Mock fs/promises
const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();

jest.unstable_mockModule('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

// Import after mocking
const { ContentHandlers } = await import('../../handlers/content-handlers.js');
const { CrawlHandlers } = await import('../../handlers/crawl-handlers.js');

// Mock the service
const mockService = {
  captureScreenshot: jest.fn(),
  crawl: jest.fn(),
};

// Mock axios client
const mockAxiosClient = {
  post: jest.fn(),
};

describe('Screenshot Local Saving', () => {
  let contentHandlers: InstanceType<typeof ContentHandlers>;
  let crawlHandlers: InstanceType<typeof CrawlHandlers>;
  const testScreenshotBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // 1x1 red pixel

  beforeEach(() => {
    jest.clearAllMocks();
    contentHandlers = new ContentHandlers(mockService as never, mockAxiosClient as never, new Map());
    crawlHandlers = new CrawlHandlers(mockService as never, mockAxiosClient as never, new Map());

    // Default mock implementations
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  describe('ContentHandlers.captureScreenshot', () => {
    it('should save screenshot to local directory when save_to_directory is provided', async () => {
      const mockDate = new Date('2024-01-15T10:30:00Z');
      jest.spyOn(globalThis, 'Date').mockImplementation(() => mockDate as never);

      mockService.captureScreenshot.mockResolvedValue({
        success: true,
        screenshot: testScreenshotBase64,
      });

      const result = await contentHandlers.captureScreenshot({
        url: 'https://example.com',
        save_to_directory: '/tmp/screenshots',
      });

      // Verify directory creation
      expect(mockMkdir).toHaveBeenCalledWith('/tmp/screenshots', { recursive: true });

      // Verify file write
      const expectedFilename = 'example-com-2024-01-15T10-30-00.png';
      const expectedPath = '/tmp/screenshots/' + expectedFilename;
      expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, Buffer.from(testScreenshotBase64, 'base64'));

      // Verify response includes saved path
      expect(result.content[1].text).toContain(`Saved to: ${expectedPath}`);
    });

    it('should handle directory creation failure gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockMkdir.mockRejectedValue(new Error('Permission denied'));

      mockService.captureScreenshot.mockResolvedValue({
        success: true,
        screenshot: testScreenshotBase64,
      });

      const result = await contentHandlers.captureScreenshot({
        url: 'https://example.com',
        save_to_directory: '/root/screenshots',
      });

      // Should still return the screenshot
      expect(result.content[0].type).toBe('image');
      expect(result.content[0].data).toBe(testScreenshotBase64);

      // Should not include saved path in text
      expect(result.content[1].text).not.toContain('Saved to:');

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save screenshot locally:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should sanitize filename for URLs with special characters', async () => {
      const mockDate = new Date('2024-01-15T10:30:00Z');
      jest.spyOn(globalThis, 'Date').mockImplementation(() => mockDate as never);

      mockService.captureScreenshot.mockResolvedValue({
        success: true,
        screenshot: testScreenshotBase64,
      });

      await contentHandlers.captureScreenshot({
        url: 'https://my-site.com:8080/path?query=value',
        save_to_directory: '/tmp/screenshots',
      });

      const expectedFilename = 'my-site-com-2024-01-15T10-30-00.png';
      const expectedPath = '/tmp/screenshots/' + expectedFilename;
      expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, expect.any(Buffer));
    });
  });

  describe('CrawlHandlers.crawl', () => {
    it('should save screenshot to local directory when screenshot_directory is provided', async () => {
      const mockDate = new Date('2024-01-15T10:30:00Z');
      jest.spyOn(globalThis, 'Date').mockImplementation(() => mockDate as never);

      mockService.crawl.mockResolvedValue({
        results: [
          {
            url: 'https://example.com',
            success: true,
            screenshot: testScreenshotBase64,
            markdown: { raw_markdown: 'Test content' },
          },
        ],
      });

      const result = await crawlHandlers.crawl({
        url: 'https://example.com',
        screenshot: true,
        screenshot_directory: '/tmp/crawl-screenshots',
      });

      // Verify directory creation
      expect(mockMkdir).toHaveBeenCalledWith('/tmp/crawl-screenshots', { recursive: true });

      // Verify file write
      const expectedFilename = 'example-com-2024-01-15T10-30-00.png';
      const expectedPath = '/tmp/crawl-screenshots/' + expectedFilename;
      expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, Buffer.from(testScreenshotBase64, 'base64'));

      // Verify response includes saved path
      const textContent = result.content.find(
        (c) => c.type === 'text' && 'text' in c && c.text?.includes('Screenshot saved'),
      );
      expect(textContent?.text).toContain(`Screenshot saved to: ${expectedPath}`);
    });

    it('should handle file save failure gracefully in crawl', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockMkdir.mockResolvedValue(undefined); // directory creation succeeds
      mockWriteFile.mockRejectedValue(new Error('Disk full')); // but file write fails

      mockService.crawl.mockResolvedValue({
        results: [
          {
            url: 'https://example.com',
            success: true,
            screenshot: testScreenshotBase64,
            markdown: { raw_markdown: 'Test content' },
          },
        ],
      });

      const result = await crawlHandlers.crawl({
        url: 'https://example.com',
        screenshot: true,
        screenshot_directory: '/tmp/crawl-screenshots',
      });

      // Should still return the screenshot as image
      const imageContent = result.content.find((c) => c.type === 'image');
      expect(imageContent?.data).toBe(testScreenshotBase64);

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save screenshot locally:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should not attempt to save when screenshot_directory is not provided', async () => {
      mockService.crawl.mockResolvedValue({
        results: [
          {
            url: 'https://example.com',
            success: true,
            screenshot: testScreenshotBase64,
            markdown: { raw_markdown: 'Test content' },
          },
        ],
      });

      await crawlHandlers.crawl({
        url: 'https://example.com',
        screenshot: true,
      });

      // Should not call fs methods
      expect(mockMkdir).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
