import { LightningElement, api } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import sanitizeLib from "@salesforce/resourceUrl/RSanitize"; // DOMPurify
import markedLib from "@salesforce/resourceUrl/RMarked"; // Marked
import katexCSS from "@salesforce/resourceUrl/RKatexcss";
import katexJs from "@salesforce/resourceUrl/RKatexJS";
import katexAutoRender from "@salesforce/resourceUrl/RKetexAutoRender";

export default class RAssistRichText extends LightningElement {
    @api getText;
    isLibLoaded = false;
    resizeObserver;

    renderedCallback() {
        if (this.isLibLoaded) {
            this.renderRichText();
            this.observeResize();
            return;
        }

        // Phase 1: Load KaTeX core libraries
        Promise.all([
            loadScript(this, katexJs),
            loadStyle(this, katexCSS)
        ])
            .then(() => {
                // Phase 2: Load additional libraries after KaTeX is ready
                return Promise.all([
                    loadScript(this, katexAutoRender),
                ]);
            })
            .then(() => {
                // Phase 3: Load additional libraries after KaTeX is ready
                return Promise.all([
                    loadScript(this, markedLib),
                    loadScript(this, sanitizeLib)
                ]);
            })
            .then(() => {
                this.isLibLoaded = true;
                this.renderRichText();
                this.observeResize();
            })
            .catch(error => {
                console.error('Error loading libraries', error);
            });
    }

    renderRichText() {
        const rawHtml = marked.parse(this.getText);
        const styledHtml = rawHtml.replace(/<p>/g, "<p style='margin-bottom: 16px;'>");
        const cleanHtml = sanitizeHtml(styledHtml);

        const target = this.template.querySelector('.lwcFormat');
        if (target) {
            target.innerHTML = cleanHtml;

            if (window.renderMathInElement && typeof window.renderMathInElement === "function") {
                window.renderMathInElement(target, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            } else {
                console.warn('renderMathInElement is not available on window.');
            }
        }
    }

    observeResize() {
        if (this.resizeObserver) return;

        const container = this.template.querySelector('.resizable-container');
        if (container && window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                // Optional: force rerender or recalculate layout if needed
                window.renderMathInElement?.(container, {
                    delimiters: [
                        { left: "$$", right: "$$", display: true },
                        { left: "$", right: "$", display: false },
                        // { left: "\\(", right: "\\)", display: false },
                        // { left: "\\[", right: "\\]", display: true }
                    ],
                    throwOnError: false
                });
            });
            this.resizeObserver.observe(container);
        }
    }

}