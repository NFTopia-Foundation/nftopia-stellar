import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateData } from './email.interface';

/**
 * Email Template Service
 * Responsible for compiling and rendering email templates using Handlebars
 */
@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);
  private readonly templateCache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, 'templates');
    this.registerHelpers();
  }

  /**
   * Render a template with the provided data
   * @param templateName Name of the template file (without .hbs extension)
   * @param data Template data
   * @returns Rendered HTML string
   */
  async render(templateName: string, data: TemplateData): Promise<string> {
    try {
      const template = await this.getTemplate(templateName);
      const enrichedData = {
        ...data,
        year: new Date().getFullYear(),
      };
      return template(enrichedData);
    } catch (error) {
      this.logger.error(
        `Failed to render template ${templateName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Generate plain text version from HTML
   * @param html HTML content
   * @returns Plain text content
   */
  htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Get or compile a template
   * @param templateName Template name
   * @returns Compiled Handlebars template
   */
  private async getTemplate(
    templateName: string,
  ): Promise<HandlebarsTemplateDelegate> {
    const cached = this.templateCache.get(templateName);
    if (cached) {
      return cached;
    }

    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateName}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateContent);

    this.templateCache.set(templateName, compiled);
    this.logger.log(`Compiled template: ${templateName}`);

    return compiled;
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Format date helper
    Handlebars.registerHelper('formatDate', (date: Date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // Currency helper
    Handlebars.registerHelper('currency', (amount: number) => {
      if (typeof amount !== 'number') return '0.00';
      return amount.toFixed(2);
    });

    // Uppercase helper
    Handlebars.registerHelper('uppercase', (str: string) => {
      if (!str) return '';
      return str.toUpperCase();
    });

    // Lowercase helper
    Handlebars.registerHelper('lowercase', (str: string) => {
      if (!str) return '';
      return str.toLowerCase();
    });

    this.logger.log('Registered Handlebars helpers');
  }

  /**
   * Clear template cache (useful for development)
   */
  clearCache(): void {
    this.templateCache.clear();
    this.logger.log('Template cache cleared');
  }
}
