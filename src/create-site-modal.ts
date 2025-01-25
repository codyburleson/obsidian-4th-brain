import { App, Modal } from "obsidian";

export class CreateSiteModal extends Modal {
  slug: string;
  onConfirm: (slug: string) => void;

  constructor(app: App, slug: string, onConfirm: (slug: string) => void) {
    super(app);
    this.slug = slug;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("p", { 
      text: `The site "${this.slug}" does not exist. Would you like to create it?` 
    });
    
    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    
    // Cancel button
    buttonContainer.createEl("button", { text: "Cancel" })
      .addEventListener("click", () => {
        this.close();
      });
    
    // Create button
    buttonContainer.createEl("button", { 
      text: "YES, CREATE SITE",
      cls: "mod-cta"
    }).addEventListener("click", () => {
      this.onConfirm(this.slug);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
