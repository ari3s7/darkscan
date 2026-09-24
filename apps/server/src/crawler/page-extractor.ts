import type { Page } from "playwright";
import type { Interaction, NavigationCandidate, PageExtraction } from "./types.js";

/**
 * Reads the loaded document. Navigation candidates are suggestions only;
 * the crawler decides which ones are safe to open.
 */
export async function extractPage(page: Page): Promise<PageExtraction> {
  // tsx keeps function names with a helper that is not defined inside the page.
  await page.evaluate("globalThis.__name = globalThis.__name || function (target) { return target; }");
  return page.evaluate((): PageExtraction => {
    const maxText = 20_000;
    const maxField = 300;
    const maxLinks = 100;
    const maxButtons = 80;
    const maxFields = 80;
    const maxForms = 20;
    const maxNav = 50;

    function clip(value: string | null | undefined, limit: number): string {
      return (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
    }

    function isHidden(element: Element): boolean {
      if (element.getAttribute("type") === "hidden" || element.hasAttribute("hidden")) return true;
      if (element.getAttribute("aria-hidden") === "true") return true;
      const style = window.getComputedStyle(element);
      return style.display === "none" || style.visibility === "hidden";
    }

    function labelText(element: Element): string {
      const aria = clip(element.getAttribute("aria-label"), maxField);
      if (aria) return aria;
      const id = element.getAttribute("id");
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const text = label ? clip(label.textContent, maxField) : "";
        if (text) return text;
      }
      const wrapping = element.closest("label");
      return wrapping ? clip(wrapping.textContent, maxField) : "";
    }

    function resolveUrl(href: string): string | null {
      try {
        const url = new URL(href, window.location.href);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.href;
      } catch {
        return null;
      }
    }

    const interactions: Interaction[] = [];
    const navigation: NavigationCandidate[] = [];
    const sensitiveName =
      /(^|[_\-])(email|e-mail|phone|mobile|tel|password|passwd|card|cvv|cvc|ssn|address|firstname|lastname|fullname|credit)([_\-]|$)/i;
    const sensitiveAutocomplete =
      /^(email|tel|name|given-name|family-name|username|new-password|current-password|street-address|address-line1|postal-code|cc-)/i;
    const unsafeAction =
      /\b(log ?out|sign ?out|delete|unsubscribe|deactivate|buy now|place order|pay now|complete purchase|add to cart|complete order)\b/i;

    function stamp(item: Interaction, element: Element): void {
      const name = element.getAttribute("name");
      if (name && /^[\w.:-]+$/.test(name)) {
        item.selector = `${item.type}[name="${name.replaceAll('"', "")}"]`;
      } else if (element.id) {
        item.selector = `#${CSS.escape(element.id)}`;
      }
      if (item.hidden) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      item.box = {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }

    function pushInteraction(item: Interaction, element?: Element): void {
      if (element) stamp(item, element);
      interactions.push(item);
    }

    function pushNav(url: string, text: string): void {
      if (navigation.length >= maxNav) return;
      if (text) navigation.push({ url, text });
      else navigation.push({ url });
    }

    function formIsSafe(form: HTMLFormElement): boolean {
      const method = (form.getAttribute("method") || "get").toLowerCase();
      if (method !== "get") return false;

      for (const control of form.querySelectorAll("input, textarea, select")) {
        const type = (control.getAttribute("type") || "").toLowerCase();
        if (type === "password" || type === "email" || type === "tel" || type === "file") return false;
        const name = control.getAttribute("name") ?? "";
        const autocomplete = control.getAttribute("autocomplete") ?? "";
        if (sensitiveName.test(name) || sensitiveAutocomplete.test(autocomplete)) return false;
      }

      for (const button of form.querySelectorAll("button, input[type='submit'], input[type='image']")) {
        const text = clip(button.textContent || button.getAttribute("value"), maxField);
        if (unsafeAction.test(text)) return false;
      }

      return true;
    }

    let linkCount = 0;
    for (const anchor of document.querySelectorAll("a[href]")) {
      if (linkCount >= maxLinks) break;
      linkCount += 1;
      const href = anchor.getAttribute("href");
      if (!href) continue;
      const text = clip(anchor.textContent || anchor.getAttribute("aria-label"), maxField);
      const disabled = anchor.getAttribute("aria-disabled") === "true";
      const hidden = isHidden(anchor);
      const interaction: Interaction = { type: "link", value: href };
      if (text) interaction.text = text;
      if (disabled) interaction.disabled = true;
      if (hidden) interaction.hidden = true;
      pushInteraction(interaction, anchor);

      if (!disabled && !anchor.hasAttribute("download")) {
        const resolved = resolveUrl(href);
        if (resolved) pushNav(resolved, text);
      }
    }

    let buttonCount = 0;
    for (const element of document.querySelectorAll(
      "button, input[type='submit'], input[type='button'], input[type='image']",
    )) {
      if (buttonCount >= maxButtons) break;
      buttonCount += 1;
      const text = clip(
        element.textContent || element.getAttribute("value") || element.getAttribute("aria-label"),
        maxField,
      );
      const disabled =
        element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
      const hidden = isHidden(element);
      const interaction: Interaction = { type: "button" };
      if (text) interaction.text = text;
      const name = element.getAttribute("name");
      if (name) interaction.name = name;
      const value = element.getAttribute("value");
      if (value) interaction.value = value;
      if (disabled) interaction.disabled = true;
      if (hidden) interaction.hidden = true;
      pushInteraction(interaction, element);

      if (disabled || unsafeAction.test(text)) continue;
      const onclick = element.getAttribute("onclick") ?? "";
      const match = onclick.match(/(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
      const target = match?.[1];
      if (!target) continue;
      const resolved = resolveUrl(target);
      if (resolved) pushNav(resolved, text);
    }

    let fieldCount = 0;
    for (const field of document.querySelectorAll("input, textarea, select")) {
      if (fieldCount >= maxFields) break;
      const typeAttr = (field.getAttribute("type") || "").toLowerCase();
      if (
        field.tagName === "INPUT" &&
        (typeAttr === "submit" || typeAttr === "button" || typeAttr === "image")
      ) {
        continue;
      }
      fieldCount += 1;

      const name = field.getAttribute("name");
      const text = labelText(field);
      const disabled = field.hasAttribute("disabled");
      const hidden = typeAttr === "hidden" || isHidden(field);
      const interaction: Interaction = { type: "input" };

      if (typeAttr === "checkbox" && field instanceof HTMLInputElement) {
        interaction.type = "checkbox";
        interaction.checked = field.checked;
        if (field.value) interaction.value = field.value.slice(0, maxField);
      } else if (typeAttr === "radio" && field instanceof HTMLInputElement) {
        interaction.type = "radio";
        interaction.checked = field.checked;
        if (field.value) interaction.value = field.value.slice(0, maxField);
      } else if (field instanceof HTMLSelectElement) {
        const selected = [...field.selectedOptions];
        const selectedValue = selected.map((option) => option.value).join(", ");
        const selectedLabel = clip(selected.map((option) => option.textContent ?? "").join(", "), maxField);
        if (selectedValue) interaction.value = selectedValue.slice(0, maxField);
        if (selectedLabel) interaction.text = selectedLabel;
      } else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        if (field.value) interaction.value = field.value.slice(0, maxField);
      }

      if (text && !interaction.text) interaction.text = text;
      if (name) interaction.name = name;
      if (disabled) interaction.disabled = true;
      if (hidden) interaction.hidden = true;
      pushInteraction(interaction, field);
    }

    let formCount = 0;
    for (const form of document.querySelectorAll("form")) {
      if (formCount >= maxForms) break;
      if (!(form instanceof HTMLFormElement)) continue;
      formCount += 1;
      const method = (form.getAttribute("method") || "get").toLowerCase();
      const actionAttr = form.getAttribute("action") || window.location.href;
      const action = resolveUrl(actionAttr) ?? actionAttr;
      const safe = formIsSafe(form);
      const interaction: Interaction = { type: "form", text: method, value: action };
      const name = form.getAttribute("name") || form.getAttribute("id");
      if (name) interaction.name = name;
      pushInteraction(interaction);

      if (!safe) continue;
      const target = new URL(action, window.location.href);
      for (const input of form.querySelectorAll("input")) {
        if (!(input instanceof HTMLInputElement)) continue;
        const type = (input.getAttribute("type") || "").toLowerCase();
        const inputName = (input.getAttribute("name") || "").toLowerCase();
        const isSearch =
          type === "search" ||
          inputName === "q" ||
          inputName === "query" ||
          inputName === "search" ||
          inputName === "s";
        if (!isSearch || !input.name || target.searchParams.has(input.name)) continue;
        const existing = input.value.trim().slice(0, 80);
        target.searchParams.set(input.name, existing || "test");
        break;
      }
      pushNav(target.href, "Search");
    }

    const description = document.querySelector('meta[name="description"]')?.getAttribute("content");
    const bodyText = (document.body?.innerText ?? "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
      .slice(0, maxText);

    return {
      title: clip(document.title, maxField) || null,
      visibleText: bodyText,
      language: clip(document.documentElement.lang, 40) || null,
      description: clip(description, 500) || null,
      interactions,
      navigation,
    };
  });
}
