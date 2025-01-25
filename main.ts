import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
import { AlertModal } from "src/alert-modal";
import { CreateSiteModal } from "./src/create-site-modal";
// import { emitKeypressEvents } from "readline";
import { SupabaseService } from "./src/supabase-service";

//import { Database, Tables, Enums } from "./src/types/supabase";

// Remember to rename these classes and interfaces!

export interface MyPluginSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseEmail: string;
  supabasePassword: string;
  defaultSiteSlug: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseEmail: "",
  supabasePassword: "",
  defaultSiteSlug: "",
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  lastTouchedDocumentUuid: string | null = null;

  async onload() {
    await this.loadSettings();

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (
          file instanceof TFile &&
          (file.extension === "canvas" || file.extension === "md")
        ) {

          menu.addItem((item) => {
            item
              .setTitle("Sync With Server")
              .setIcon("send") // Obsidian uses the Lucide icon library: https://lucide.dev/icons
              .setSection("4thBrain")
              .onClick(async () => {
                await this.syncWithServer(file);
              });
          });

          // We need to get the uuid from the frontmatter before the file is deleted
          this.app.fileManager.processFrontMatter(file, (fm) => {

            // SCENARIO: Sync to update existing document
            // GIVEN the Obsidian user selects 'Sync with Server
            // WHEN the markdown document has a uuid property
            // AND the markdown document has a version property
    
            if (fm["uuid"]) {
              this.lastTouchedDocumentUuid = fm["uuid"];
            } else {
              this.lastTouchedDocumentUuid = null;
            }

            console.log("-- 4thBrain.onLoad() > file-menu > lastTouchedSDocumentUuid: ", this.lastTouchedDocumentUuid);

          });

        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        console.log("-- 4thBrain.onLoad() > vault.on('delete') > file: ", file);
        
        if (file instanceof TFile) {
          try {
            if (this.lastTouchedDocumentUuid) {
              try {
                const supabase = new SupabaseService(
                  this.settings.supabaseUrl,
                  this.settings.supabaseAnonKey
                );
                await supabase.ensureSession(
                  this.settings.supabaseEmail,
                  this.settings.supabasePassword
                );
                await supabase.setDocumentStateToRemoved(this.lastTouchedDocumentUuid);
                new Notice(`Marked server document ${this.lastTouchedDocumentUuid} as removed`);
                this.lastTouchedDocumentUuid = null;
              } catch (error) {
                console.error('Failed to mark document as removed:', error);
                new Notice('Failed to mark document as removed');
              }
            }
          } catch (error) {
            new AlertModal(this.app, `Failed to mark server document as removed with uuid: ${this.lastTouchedDocumentUuid}\n error: ${error.message}`).open();
          }
        }
      })
    );

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon(
      "dice",
      "Sample Plugin",
      (evt: MouseEvent) => {
        console.debug(
          "-- main.onLoad() RibbonIcon MouseEvent handler triggered..."
        );
        new Notice("RibbonIcon MouseEvent handler triggered ");
      }
    );
    // Perform additional things with the ribbon
    ribbonIconEl.addClass("my-plugin-ribbon-class");

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText("Status Bar Text");

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: "open-sample-modal-simple",
      name: "Open sample modal (simple)",
      callback: () => {
        new SampleModal(this.app).open();
      },
    });
    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: "sample-editor-command",
      name: "Sample editor command",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        console.log(editor.getSelection());
        editor.replaceSelection("Sample Editor Command");
      },
    });
    // This adds a complex command that can check whether the current state of the app allows execution of the command
    this.addCommand({
      id: "open-sample-modal-complex",
      name: "Open sample modal (complex)",
      checkCallback: (checking: boolean) => {
        // Conditions to check
        const markdownView =
          this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView) {
          // If checking is true, we're simply "checking" if the command can be run.
          // If checking is false, then we want to actually perform the operation.
          if (!checking) {
            new SampleModal(this.app).open();
          }

          // This command will only show up in Command Palette when the check function returns true
          return true;
        }
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SampleSettingTab(this.app, this));

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    this.registerDomEvent(document, "click", (evt: MouseEvent) => {
      console.log("click", evt);
    });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    this.registerInterval(
      window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
    );

    console.log("4th Brain Plugin v0.0.1-cb3 loaded");
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async syncWithServer(file: TFile) {
    try {
      if (!this.settings.defaultSiteSlug) {
        new AlertModal(
          this.app,
          "A default site slug is required. Please configure it in the 4th Brain plugin settings before syncing."
        ).open();
        return;
      }

      console.log(">> 4thBrain > syncWithServer() > file: ", file);

      const filePath = file.path;
      const folderPath = filePath.substring(0, filePath.lastIndexOf("/") + 1);

      const supabaseService = new SupabaseService(
        this.settings.supabaseUrl,
        this.settings.supabaseAnonKey
      );

      // This will handle checking the session and signing in if needed
      const user = await supabaseService.ensureSession(
        this.settings.supabaseEmail,
        this.settings.supabasePassword
      );

      // Check if site exists before proceeding
      const siteExists = await supabaseService.siteSlugExists(this.settings.defaultSiteSlug);
      if (!siteExists) {
        new CreateSiteModal(this.app, this.settings.defaultSiteSlug, async (confirmedSlug) => {
          try {
            const site = await supabaseService.createSite(confirmedSlug);
            console.debug("Site created successfully:", site);
            // Now that the site is created, continue with the sync
            await this.syncWithServer(file);
          } catch (error) {
            console.error("Failed to create site:", error);
            new AlertModal(
              this.app,
              `Failed to create site: ${error.message}`
            ).open();
          }
        }).open();
        return;
      }

      // If we get here, we have an active session with a valid user and confirmed site
      console.log(">> 4thBrain > Session established for user:", user.email);

      // TO DO: Make an Interface for Document
      let document = {
        id: "",
        version: 1,
        path: "",
        name: file.basename,
        state: "published",
        content: "",
      };

      await this.app.fileManager.processFrontMatter(file, (fm) => {
        console.debug(
          "-- 4thbrain > Sync > frontmatter: \n",
          JSON.stringify(fm, null, 2)
        );

        // SCENARIO: Sync to update existing document
        // GIVEN the Obsidian user selects 'Sync with Server
        // WHEN the markdown document has a uuid property
        // AND the markdown document has a version property

        if (fm["uuid"] && fm["version"]) {
          // Even when we are theoretically updating an existing doc,
          // because we manage versions in a single table,  we still need to INSERT

          document.version = fm["version"] + 1;
          fm.version = document.version;
        } else {
          let uuid = crypto.randomUUID();
          fm.uuid = uuid;
          document.id = uuid;
          fm.version = 1;
          document.version = 1;
        }

        if (fm.state) {
          document.state = fm.state;
        }

        document.id = fm.uuid;
        document.path = folderPath;
      });

      const fileContent = await this.app.vault.cachedRead(file);
      document.content = fileContent;

      console.debug(
        "-- 4thbrain > Sync > document just before CRUD operation: \n",
        JSON.stringify(document, null, 2)
      );

      let crudResult = await supabaseService.insertDocument(
        document, 
        this.settings.defaultSiteSlug
      );

      // TODO: Implement your sync logic here
    } catch (error) {
      console.error(">> 4thBrain > Error during sync:", error);
      // new Notice("Failed to sync with Supabase: " + error.message);
      new AlertModal(
        this.app,
        "Failed to sync with Supabase: " + error.message
      ).open();
    }
  }
}

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText("Woah!");
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class SampleSettingTab extends PluginSettingTab {
  plugin: MyPlugin;
  isDefaultSiteSlugDirty: boolean = false;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async hide() {
    if (this.isDefaultSiteSlugDirty) {
      const slug = this.plugin.settings.defaultSiteSlug;
      if (slug) {
        try {
          const supabaseService = new SupabaseService(
            this.plugin.settings.supabaseUrl,
            this.plugin.settings.supabaseAnonKey
          );
          
          // Ensure we have an active session
          await supabaseService.ensureSession(
            this.plugin.settings.supabaseEmail,
            this.plugin.settings.supabasePassword
          );

          const exists = await supabaseService.siteSlugExists(slug);
          
          if (exists) {
            console.debug(`Site with slug "${slug}" already exists`);
          } else {
            new CreateSiteModal(this.app, slug, async (confirmedSlug) => {
              try {
                const site = await supabaseService.createSite(confirmedSlug);
                console.debug("Site created successfully:", site);
              } catch (error) {
                console.error("Failed to create site:", error);
                new AlertModal(
                  this.app,
                  `Failed to create site: ${error.message}`
                ).open();
              }
            }).open();
          }
        } catch (error) {
          console.error("Error checking site slug:", error);
          new AlertModal(
            this.app,
            `Error checking site slug: ${error.message}`
          ).open();
        }
      }
      this.isDefaultSiteSlugDirty = false;
    }
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Supabase URL")
      .setDesc("The URL of your Supabase project")
      .addText((text) =>
        text
          .setPlaceholder("project URL")
          .setValue(this.plugin.settings.supabaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.supabaseUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Supabase Anon Key")
      .setDesc(
        "The Supabase project anon key. If you are hosting Supabase yourself, you can fing this in the .env file (ANON_KEY in supabase/docker/.env)"
      )
      .addText((text) => {
        text.inputEl.type = "password";
        return text
          .setPlaceholder("anon key")
          .setValue(this.plugin.settings.supabaseAnonKey)
          .onChange(async (value) => {
            this.plugin.settings.supabaseAnonKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Supabase Email")
      .setDesc("Supabase signin email")
      .addText((text) =>
        text
          .setPlaceholder("signin email")
          .setValue(this.plugin.settings.supabaseEmail)
          .onChange(async (value) => {
            this.plugin.settings.supabaseEmail = value;
            await this.plugin.saveSettings();
          })
      );

      new Setting(containerEl)
      .setName("Supabase Password")
      .setDesc("Supabase signin password")
      .addText((text) => {
        text.inputEl.type = "password";
        return text
          .setPlaceholder("password")
          .setValue(this.plugin.settings.supabasePassword)
          .onChange(async (value) => {
            this.plugin.settings.supabasePassword = value;
            await this.plugin.saveSettings();
          });
      });
      
    new Setting(containerEl)
      .setName("Default Site Slug")
      .setDesc(
        "A URL-friendly short name for your site; the default site slug will be used when syncing documents if no site slug is provided in the frontmatter."
      )
      .addText((text) =>
        text
          .setPlaceholder("site-slug")
          .setValue(this.plugin.settings.defaultSiteSlug)
          .onChange(async (value) => {
            this.plugin.settings.defaultSiteSlug = value;
            this.isDefaultSiteSlugDirty = true;
            await this.plugin.saveSettings();
          })
      );
  }
}

