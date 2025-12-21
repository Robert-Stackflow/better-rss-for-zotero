// Content Extractor Module using @mozilla/readability
import { Readability } from "@mozilla/readability";
import { getSettings } from "./preferenceScript";

export class ContentExtractor {
  constructor() {}

  /**
   * Extract content from URL and save to item
   */
  async extractAndSave(item: Zotero.Item): Promise<void> {
    if (!item.isFeedItem) {
      throw new Error("Item is not a feed item");
    }

    const url = item.getField("url") as string;
    if (!url) {
      throw new Error("Item has no URL");
    }

    ztoolkit.log(`Extracting content from: ${url}`);

    // Get settings
    const settings = getSettings();

    // Fetch HTML content
    const html = await this._fetchHTML(url);

    // Parse and extract content
    const extracted = this._extractContent(html, url);

    if (!extracted) {
      throw new Error("Failed to extract content");
    }

    // Check if item is in a feed library (read-only)
    const library = Zotero.Libraries.get(item.libraryID);
    let targetItem = item;
    let feedName = "";

    if (library && library.libraryType === "feed") {
      // Feed items are read-only, need to save to user library
      ztoolkit.log(
        `Item is in feed library, translating to user library: ${item.id}`
      );

      // Get feed name for tagging and folder
      try {
        const feed = Zotero.Feeds.get(library.id);
        if (feed) {
          feedName = feed.name;
        }
      } catch (e) {
        ztoolkit.log(`Failed to get feed name: ${(e as Error).message}`);
      }

      ztoolkit.log(`FeedName: ${feedName}`);

      // Check if item already exists in target collection before processing
      if (settings.saveToFolder && settings.saveFolderPathTemplate) {
        const collectionPath = this._parsePathTemplate(
          settings.saveFolderPathTemplate,
          feedName
        );

        // Get or create the target collection
        const targetCollection = await this._getOrCreateCollectionByPath(
          Zotero.Libraries.userLibraryID,
          collectionPath
        );

        // Check if item with same URL already exists in this collection
        if (
          targetCollection &&
          this._isItemProcessedInCollection(targetCollection.id, url)
        ) {
          ztoolkit.log(
            `Item with same URL already exists in collection, skipping: ${url}`
          );
          return;
        }
      }

      targetItem = await this._translateFeedItem(item, feedName, settings);

      // Move to collection if enabled
      if (settings.saveToFolder && settings.saveFolderPathTemplate) {
        const collectionPath = this._parsePathTemplate(
          settings.saveFolderPathTemplate,
          feedName
        );
        await this._moveToCollectionByPath(targetItem, collectionPath);
      }
    }

    // Create Note if enabled
    if (settings.saveNote) {
      await this._createNote(targetItem, extracted, url);
    }

    // Create web snapshot if enabled
    if (settings.saveSnapshot) {
      await this._createSnapshot(targetItem, url);
    }

    if (settings.saveHTML) {
      await this._createHTMLAttachment(targetItem, extracted, url);
    }

    ztoolkit.log(`Successfully processed item: ${targetItem.id}`);
  }

  /**
   * Check if item with same URL already exists in collection
   */
  private _isItemProcessedInCollection(
    collectionID: number,
    url: string
  ): boolean {
    try {
      const collection = Zotero.Collections.get(collectionID);
      if (!collection) {
        return false;
      }

      // Get all items in this collection
      const items = collection.getChildItems(false, false);

      // Check if any item has the same URL
      for (const existingItem of items) {
        try {
          if (
            existingItem &&
            !existingItem.isNote() &&
            !existingItem.isAttachment()
          ) {
            const existingURL = existingItem.getField("url") as string;
            if (existingURL && existingURL === url) {
              ztoolkit.log(
                `Found existing item with same URL in collection ${collectionID}: Item ${existingItem.id}`
              );
              return true;
            }
          }
        } catch (e) {
          // Skip items that can't be accessed
          continue;
        }
      }

      return false;
    } catch (e) {
      ztoolkit.log(
        `Error checking for existing items: ${(e as Error).message}`
      );
      return false;
    }
  }

  /**
   * Get or create collection by path (returns the deepest collection)
   */
  private async _getOrCreateCollectionByPath(
    libraryID: number,
    pathParts: string[]
  ): Promise<Zotero.Collection | null> {
    if (!pathParts || pathParts.length === 0) {
      return null;
    }

    try {
      let parentCollection: Zotero.Collection | null = null;

      // Create nested collections
      for (let i = 0; i < pathParts.length; i++) {
        const collectionName = pathParts[i];
        let collections: Zotero.Collection[];

        // Get collections at current level
        if (parentCollection) {
          // Get child collections of parent
          collections = Zotero.Collections.getByParent(
            parentCollection.id,
            false
          );
        } else {
          // Get root level collections
          collections = Zotero.Collections.getByLibrary(libraryID, false);
          // Filter to only root collections (no parent)
          collections = collections.filter((c) => !c.parentID);
        }

        // Find existing collection with the same name
        let collection = collections.find((c) => c.name === collectionName);

        if (!collection) {
          // Create new collection
          collection = new Zotero.Collection();
          collection.name = collectionName;
          if (parentCollection) {
            collection.parentID = parentCollection.id;
          }
          await collection.saveTx();
          ztoolkit.log(
            `Created new collection: ${collectionName} (ID: ${
              collection.id
            }, Parent: ${parentCollection?.id || "none"})`
          );
        }

        parentCollection = collection;
      }

      return parentCollection;
    } catch (e) {
      ztoolkit.log(
        `Failed to get/create collection path: ${(e as Error).message}`
      );
      return null;
    }
  }

  /**
   * Translate feed item to user library
   */
  private async _translateFeedItem(
    feedItem: Zotero.Item,
    feedName: string,
    settings: any
  ): Promise<Zotero.Item> {
    // Create a new item in user's library
    const newItem = new Zotero.Item("blogPost");
    newItem.libraryID = Zotero.Libraries.userLibraryID;

    // Copy basic fields
    newItem.setField("title", feedItem.getField("title"));
    newItem.setField("url", feedItem.getField("url"));
    newItem.setField("accessDate", new Date().toISOString().split("T")[0]);

    // Copy creators if any, otherwise use default
    const creators = feedItem.getCreators();
    if (creators && creators.length > 0) {
      creators.forEach((creator: any) => {
        newItem.setCreator(newItem.getCreators().length, creator);
      });
    } else {
      // Add a default creator if none exist
      newItem.setCreator(0, {
        firstName: "",
        lastName: "Unknown Author",
        creatorType: "author",
      });
    }

    // Copy abstract if exists, extract text from HTML
    try {
      const abstract = feedItem.getField("abstractNote");
      if (abstract) {
        const plainTextAbstract = this._extractTextFromHTML(abstract);
        newItem.setField("abstractNote", plainTextAbstract);
      }
    } catch (e) {
      // Field may not exist
    }

    // Copy date if exists
    try {
      const date = feedItem.getField("date");
      if (date) {
        newItem.setField("date", date);
      }
    } catch (e) {
      // Field may not exist
    }

    // Add tags based on settings
    if (settings.addBetterRSSTag) {
      newItem.addTag("Better-RSS", 0);
    }
    if (settings.addFeedNameTag && feedName) {
      newItem.addTag(feedName, 0);
    }

    await newItem.saveTx();
    ztoolkit.log(`Created new item in user library: ${newItem.id}`);
    return newItem;
  }

  /**
   * Parse path template and replace variables
   */
  private _parsePathTemplate(template: string, feedName: string): string[] {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");

    // Calculate week number (ISO 8601)
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (now.getTime() - firstDayOfYear.getTime()) / 86400000;
    const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
      .toString()
      .padStart(2, "0");

    // Replace variables
    let path = template
      .replace(/%feedName%/g, feedName || "Unknown Feed")
      .replace(/%year%/g, year)
      .replace(/%month%/g, month)
      .replace(/%week%/g, week)
      .replace(/%day%/g, day);

    // Split path by / and filter empty parts
    return path.split("/").filter((p) => p.trim().length > 0);
  }

  /**
   * Move item to collection by path (supports nested collections)
   */
  private async _moveToCollectionByPath(
    item: Zotero.Item,
    pathParts: string[]
  ): Promise<void> {
    if (!pathParts || pathParts.length === 0) {
      return;
    }

    try {
      let parentCollection: Zotero.Collection | null = null;

      // Create nested collections
      for (let i = 0; i < pathParts.length; i++) {
        const collectionName = pathParts[i];
        let collections: Zotero.Collection[];

        // Get collections at current level
        if (parentCollection) {
          // Get child collections of parent
          collections = Zotero.Collections.getByParent(
            parentCollection.id,
            false
          );
          ztoolkit.log(
            `Looking for child collection "${collectionName}" under parent "${parentCollection.name}" (ID: ${parentCollection.id}), found ${collections.length} children`
          );
        } else {
          // Get root level collections
          collections = Zotero.Collections.getByLibrary(item.libraryID, false);
          // Filter to only root collections (no parent)
          collections = collections.filter((c) => !c.parentID);
          ztoolkit.log(
            `Looking for root collection "${collectionName}" in library ${item.libraryID}, found ${collections.length} root collections`
          );
        }

        // Find existing collection with the same name
        let collection = collections.find((c) => c.name === collectionName);

        if (!collection) {
          // Create new collection
          collection = new Zotero.Collection();
          collection.name = collectionName;
          if (parentCollection) {
            collection.parentID = parentCollection.id;
          }
          await collection.saveTx();
          ztoolkit.log(
            `Created new collection: ${collectionName} (ID: ${
              collection.id
            }, Parent: ${parentCollection?.id || "none"})`
          );
        } else {
          ztoolkit.log(
            `Found existing collection: ${collectionName} (ID: ${
              collection.id
            }, Parent: ${collection.parentID || "none"})`
          );
        }

        parentCollection = collection;
      }

      // Add item to the deepest collection
      if (parentCollection) {
        // Check if item is already in this collection
        const itemCollections = item.getCollections();
        if (!itemCollections.includes(parentCollection.id)) {
          // Add item to collection using addItem method
          await Zotero.DB.executeTransaction(async () => {
            item.addToCollection(parentCollection.id);
            await item.save();
          });
          ztoolkit.log(
            `Added item ${item.id} to collection path: ${pathParts.join(" > ")}`
          );
        } else {
          ztoolkit.log(
            `Item ${item.id} already in collection: ${pathParts.join(" > ")}`
          );
        }
      }
    } catch (e) {
      ztoolkit.log(
        `Failed to move item to collection path: ${(e as Error).message}`
      );
      ztoolkit.log(`Error stack: ${(e as Error).stack}`);
    }
  }

  /**
   * Fetch HTML content from URL
   */
  private async _fetchHTML(url: string): Promise<string> {
    try {
      const response = await Zotero.HTTP.request("GET", url, {
        responseType: "text",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      return response.response;
    } catch (e) {
      throw new Error(`Failed to fetch URL: ${(e as Error).message}`);
    }
  }

  /**
   * Extract content using Readability
   */
  private _extractContent(
    html: string,
    url: string
  ): {
    title: string;
    content: string;
    textContent: string;
    excerpt: string;
  } | null {
    try {
      // Create a DOM from HTML using DOMParser
      const win = Zotero.getMainWindow();
      const parser = new win.DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Use Readability to extract content
      const reader = new Readability(doc);
      const article = reader.parse();

      if (!article) {
        return null;
      }

      // Fix relative image URLs in content
      const fixedContent = this._fixRelativeImageURLs(
        article.content || "",
        url
      );

      return {
        title: article.title || "Untitled",
        content: fixedContent,
        textContent: article.textContent || "",
        excerpt: article.excerpt || "",
      };
    } catch (e) {
      ztoolkit.log(`Content extraction error: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Create note with extracted content
   */
  private async _createNote(
    item: Zotero.Item,
    extracted: {
      title: string;
      content: string;
      textContent: string;
      excerpt: string;
    },
    url: string
  ): Promise<void> {
    const note = new Zotero.Item("note");
    note.libraryID = item.libraryID;
    note.parentID = item.id;

    const noteHTML = this._buildNoteHTML(item, extracted, url);
    note.setNote(noteHTML);

    await note.saveTx();
    ztoolkit.log(`Created note for item: ${item.id}`);
  }

  /**
   * Build HTML content for note
   */
  private _buildNoteHTML(
    item: Zotero.Item,
    extracted: { title: string; content: string },
    url: string
  ): string {
    const date = new Date().toLocaleString();

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4285f4;">
          <h2 style="margin: 0 0 10px 0; color: #333;">${this._escapeHTML(
            extracted.title
          )}</h2>
          <div style="font-size: 0.9em; color: #666;">
            <p style="margin: 5px 0;">
              <strong>Original URL:</strong> 
              <a href="${this._escapeHTML(
                url
              )}" style="color: #4285f4; text-decoration: none;">${this._escapeHTML(
      url
    )}</a>
            </p>
            <p style="margin: 5px 0;"><strong>Extracted:</strong> ${date}</p>
          </div>
        </div>
        <div style="margin-top: 20px; color: #333;">
          ${extracted.content}
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 0.85em; color: #888;">
          <p>Content extracted by <strong>Better RSS for Zotero</strong></p>
        </div>
      </div>
    `;
  }

  /**
   * Create web snapshot from URL
   */
  private async _createSnapshot(item: Zotero.Item, url: string): Promise<void> {
    try {
      await Zotero.Attachments.importFromURL({
        libraryID: item.libraryID,
        url: url,
        parentItemID: item.id,
        title: `Web Snapshot of ${item.getField("title")}`,
        contentType: "text/html",
        referrer: url,
      });
      ztoolkit.log(`Created web snapshot for item: ${item.id}`);
    } catch (e) {
      ztoolkit.log(`Failed to create snapshot: ${(e as Error).message}`);
    }
  }

  /**
   * Create HTML attachment from extracted content
   */
  private async _createHTMLAttachment(
    item: Zotero.Item,
    extracted: {
      title: string;
      content: string;
      textContent: string;
      excerpt: string;
    },
    url: string
  ): Promise<void> {
    try {
      // Create a safe filename from item title
      const title = item.getField("title") as string;
      const fileName = `${title}.html`.replace(/[<>:"/\\|?*]/g, "_");

      // Build complete HTML document
      const htmlContent = this._buildHTMLDocument(item, extracted, url);

      // Create temporary file
      const tempFile = Zotero.getTempDirectory();
      tempFile.append(fileName);

      // Write HTML content to file
      await Zotero.File.putContentsAsync(tempFile, htmlContent);

      // Import file as attachment
      await Zotero.Attachments.importFromFile({
        file: tempFile,
        libraryID: item.libraryID,
        parentItemID: item.id,
        title: `HTML of ${title}`,
      });

      // Clean up temp file
      try {
        tempFile.remove(false);
      } catch (e) {
        // Ignore cleanup errors
      }

      ztoolkit.log(`Created HTML attachment for item: ${item.id}`);
    } catch (e) {
      ztoolkit.log(`Failed to create HTML attachment: ${(e as Error).message}`);
    }
  }

  /**
   * Build complete HTML document for attachment
   */
  private _buildHTMLDocument(
    item: Zotero.Item,
    extracted: { title: string; content: string },
    url: string
  ): string {
    const date = new Date().toLocaleString();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escapeHTML(extracted.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      background: #fff;
    }
    .header {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid #4285f4;
    }
    .header h1 {
      margin: 0 0 15px 0;
      color: #333;
      font-size: 2em;
    }
    .metadata {
      font-size: 0.9em;
      color: #666;
    }
    .metadata p {
      margin: 8px 0;
    }
    .metadata a {
      color: #4285f4;
      text-decoration: none;
      word-break: break-all;
    }
    .metadata a:hover {
      text-decoration: underline;
    }
    .content {
      margin-top: 30px;
      font-size: 1.1em;
    }
    .content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 20px auto;
    }
    .content pre {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    .content code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    .content blockquote {
      border-left: 4px solid #ddd;
      margin: 20px 0;
      padding-left: 20px;
      color: #666;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 0.85em;
      color: #888;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this._escapeHTML(extracted.title)}</h1>
    <div class="metadata">
      <p><strong>原文链接：</strong> <a href="${this._escapeHTML(
        url
      )}" target="_blank">${this._escapeHTML(url)}</a></p>
      <p><strong>提取时间：</strong> ${date}</p>
    </div>
  </div>
  <div class="content">
    ${extracted.content}
  </div>
  <div class="footer">
    <p>Content extracted by <strong>Better RSS for Zotero</strong></p>
  </div>
</body>
</html>`;
  }

  /**
   * Escape HTML
   */
  private _escapeHTML(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Extract plain text from HTML
   */
  private _extractTextFromHTML(html: string): string {
    try {
      const win = Zotero.getMainWindow();
      const parser = new win.DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      return doc.body.textContent?.trim() || "";
    } catch (e) {
      // If parsing fails, try simple regex strip
      return html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  /**
   * Fix relative image URLs in content
   */
  private _fixRelativeImageURLs(content: string, baseUrl: string): string {
    try {
      const urlObj = new URL(baseUrl);
      const origin = urlObj.origin; // e.g., https://example.com
      const pathname = urlObj.pathname; // e.g., /article/page.html
      const basePath = pathname.substring(0, pathname.lastIndexOf("/") + 1); // e.g., /article/

      // Replace image src attributes
      return content.replace(
        /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
        (match, before, src, after) => {
          let newSrc = src;

          // Skip if already absolute URL
          if (src.match(/^https?:\/\//i) || src.match(/^data:/i)) {
            return match;
          }

          // Handle root-relative URLs starting with /
          if (src.startsWith("/")) {
            newSrc = origin + src;
          }
          // Handle relative URLs
          else if (!src.startsWith("//")) {
            newSrc = origin + basePath + src;
          }
          // Handle protocol-relative URLs
          else if (src.startsWith("//")) {
            newSrc = urlObj.protocol + src;
          }

          return `<img${before}src="${newSrc}"${after}>`;
        }
      );
    } catch (e) {
      ztoolkit.log(`Failed to fix relative URLs: ${(e as Error).message}`);
      return content;
    }
  }
}
