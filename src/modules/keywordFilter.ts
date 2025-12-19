// Keyword Filter Module
export class KeywordFilter {
  /**
   * Parse filter rules from text
   * Format:
   * +keyword - must contain
   * -keyword - must not contain
   * ?keyword - contains any (OR logic)
   */
  static parseRules(rulesText: string): {
    mustContain: string[];
    mustNotContain: string[];
    containsAny: string[];
  } {
    const mustContain: string[] = [];
    const mustNotContain: string[] = [];
    const containsAny: string[] = [];

    if (!rulesText || rulesText.trim() === "") {
      return { mustContain, mustNotContain, containsAny };
    }

    const lines = rulesText.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Split by spaces to get multiple keywords on same line
      const words = trimmed.split(/\s+/);
      for (const word of words) {
        if (!word) continue;

        if (word.startsWith("+")) {
          const keyword = word.substring(1).trim();
          if (keyword) mustContain.push(keyword);
        } else if (word.startsWith("-")) {
          const keyword = word.substring(1).trim();
          if (keyword) mustNotContain.push(keyword);
        } else if (word.startsWith("?")) {
          const keyword = word.substring(1).trim();
          if (keyword) containsAny.push(keyword);
        }
      }
    }

    return { mustContain, mustNotContain, containsAny };
  }

  /**
   * Check if text matches filter rules
   */
  static matchesRules(
    text: string,
    rules: {
      mustContain: string[];
      mustNotContain: string[];
      containsAny: string[];
    }
  ): boolean {
    if (!text) return false;

    const lowerText = text.toLowerCase();

    // Check must not contain (highest priority)
    for (const keyword of rules.mustNotContain) {
      if (lowerText.includes(keyword.toLowerCase())) {
        ztoolkit.log(`Filtered out by must-not-contain: ${keyword}`);
        return false;
      }
    }

    // Check must contain (all required)
    for (const keyword of rules.mustContain) {
      if (!lowerText.includes(keyword.toLowerCase())) {
        ztoolkit.log(`Filtered out by must-contain: ${keyword}`);
        return false;
      }
    }

    // Check contains any (at least one required if list is not empty)
    if (rules.containsAny.length > 0) {
      let hasAny = false;
      for (const keyword of rules.containsAny) {
        if (lowerText.includes(keyword.toLowerCase())) {
          hasAny = true;
          break;
        }
      }
      if (!hasAny) {
        ztoolkit.log(
          `Filtered out by contains-any: none of ${rules.containsAny.join(
            ", "
          )} found`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Check if item matches filter rules
   */
  static shouldExtractItem(item: Zotero.Item, rulesText: string): boolean {
    if (!rulesText || rulesText.trim() === "") {
      return true; // No filter rules, extract all
    }

    const rules = this.parseRules(rulesText);

    // Check if there are any rules
    if (
      rules.mustContain.length === 0 &&
      rules.mustNotContain.length === 0 &&
      rules.containsAny.length === 0
    ) {
      return true;
    }

    // Get item title and abstract for checking
    const title = item.getField("title") as string;
    let abstract = "";
    try {
      abstract = item.getField("abstractNote") as string;
    } catch (e) {
      // Abstract may not exist
    }

    const textToCheck = `${title} ${abstract}`;

    return this.matchesRules(textToCheck, rules);
  }
}
