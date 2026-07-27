import { EmailTemplateService } from './email-template.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock the file system
jest.mock('fs');
jest.mock('handlebars', () => ({
  compile: jest.fn((template: string) => (data: Record<string, unknown>) => {
    // Simple mock template renderer
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''));
  }),
  registerHelper: jest.fn(),
}));

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  const templatesDir = path.join(__dirname, 'templates');

  beforeEach(() => {
    service = new EmailTemplateService();
    jest.clearAllMocks();
  });

  describe('render', () => {
    it('should render a template with provided data', async () => {
      const mockHtml = '<html>Hello {{username}}</html>';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockHtml);

      const result = await service.render('verification', {
        username: 'TestUser',
      });

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should throw when template does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.render('non-existent', {})).rejects.toThrow(
        'Template not found: non-existent',
      );
    });

    it('should cache templates after first render', async () => {
      const mockHtml = '<html>{{username}}</html>';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockHtml);

      // Render twice
      await service.render('verification', { username: 'User1' });
      await service.render('verification', { username: 'User2' });

      // readFileSync should only be called once due to caching
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should include current year in template data', async () => {
      const mockHtml = '<html>{{year}}</html>';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockHtml);

      const result = await service.render('test', {});

      expect(result).toContain(String(new Date().getFullYear()));
    });
  });

  describe('htmlToText', () => {
    it('should strip HTML tags', () => {
      const html = '<html><body><h1>Hello</h1><p>World</p></body></html>';
      const text = service.htmlToText(html);

      expect(text).not.toContain('<html>');
      expect(text).not.toContain('<h1>');
      expect(text).toContain('Hello');
      expect(text).toContain('World');
    });

    it('should strip style tags and content', () => {
      const html = '<style>body { color: red; }</style><p>Content</p>';
      const text = service.htmlToText(html);

      expect(text).not.toContain('body { color: red; }');
      expect(text).toContain('Content');
    });

    it('should strip script tags and content', () => {
      const html = '<script>alert("xss")</script><p>Content</p>';
      const text = service.htmlToText(html);

      expect(text).not.toContain('alert');
      expect(text).toContain('Content');
    });
  });

  describe('clearCache', () => {
    it('should clear the template cache', async () => {
      const mockHtml = '<html>{{username}}</html>';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockHtml);

      // Prime the cache
      await service.render('verification', { username: 'User' });

      // Clear cache
      service.clearCache();

      // Render again - should read file again
      await service.render('verification', { username: 'User2' });
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });
});
