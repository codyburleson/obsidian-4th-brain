import {
  App,
  CachedMetadata,
  Editor,
  EmbedCache,
  getLinkpath,
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

          // It is possible that the user right-clicked on a document because they are aout to delete it.
          // We need to get the uuid from the frontmatter before the file is deleted!
          this.app.fileManager.processFrontMatter(file, (fm) => {
            if (fm["uuid"]) {
              this.lastTouchedDocumentUuid = fm["uuid"];
            } else {
              this.lastTouchedDocumentUuid = null;
            }
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

      // ENSURE SESSION ------------------------------------------------------------------------
      // This will handle checking the session and signing in if needed
      // ---------------------------------------------------------------------------------------
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

      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        console.debug(
          "-- 4thbrain > Sync > frontmatter: \n",
          JSON.stringify(frontmatter, null, 2)
        );



        if (frontmatter["uuid"] && frontmatter["version"]) {
          // Document already exists on the server, we assume, since it has a uuid and version
          // However, even though we are updating an existing doc, we still need to INSERT it 
          // into the databased instead of UPDATE an existing row because each version is a new row.
          document.version = frontmatter["version"] + 1;
          frontmatter.version = document.version;
        } else {
          let uuid = crypto.randomUUID();
          frontmatter.uuid = uuid;
          document.id = uuid;
          frontmatter.version = 1;
          document.version = 1;
        }

        if (frontmatter.state) {
          document.state = frontmatter.state;
        }

        document.id = frontmatter.uuid;
        document.path = folderPath;
      });

      const fileContent = await this.app.vault.cachedRead(file);
      document.content = fileContent;

      // Right here, now that we have the entire document content, we can parse it 
      // for all of the image attachments from the document. For now, I am attempting this via
      // Obsidian API methods, but it may be necessary to parse the markdown AST instead.

      const fileCache: CachedMetadata | null = this.app.metadataCache.getFileCache(file);

      if (fileCache) {
        console.debug(">> 4thBrain > Sync > fileCache: ", fileCache);
        if(fileCache.embeds) {
            console.debug(">> 4thBrain > Sync > Embedded files: ", fileCache.embeds);
            let embeds: EmbedCache[] = fileCache.embeds;

            // For each embedded file, we need to get the full system file path
            // and upload it to the server. 
            // We don't want to upload the same file twice, so we need to check if the file
            // already exists on the server before uploading it. If it does, we compare the 
            // modified date of the file with the modified date of the file on the server.
            // If the modified date is the same, we skip the upload.
            // If the modified date is different, we upload the file.
            // We also need to check if the file is a duplicate of another file on the server.
            // If it is, we skip the upload.
            // If it is not, we upload the file.
            
            for (let embed of embeds) {

              const embedFile: TFile | null = this.app.metadataCache.getFirstLinkpathDest( getLinkpath(embed.link), embed.link );

              if (embedFile) {

                // We store the file in the bucket with the same path as the file in the vault.
                let vaultPath = embedFile.path;
                console.debug(`-- 4thBrain > Sync > vaultPath: ${vaultPath}`);
                
                let appPath = this.app.vault.adapter.getResourcePath(embedFile.path);
                console.debug(`-- 4thBrain > Sync > appPath: ${appPath}`);

                const lastModifiedDate = new Date(embedFile.stat.mtime);

                // We'll need the full path to the file in the bucket in order to upload it!
                // const filePath = decodeURIComponent(appPath.replace(/app:\/\/[^\/]+\//, '/').split('?')[0]);
                // console.debug(`-- 4thBrain > Sync > filePath: ${filePath}`);

                // const encodedPath = encodeURIComponent(filePath);
                // console.debug(`-- 4thBrain > Sync > encodedPath: ${encodedPath}`);
                
                try {

                  // const fileExists = await supabaseService.checkFileExists('resources', vaultPath);
                  // console.debug(`-- 4thBrain > Sync > fileExists: ${fileExists}`);

                  // const { exists, needsUpdate } = await supabaseService.checkResourceExists(
                  //   vaultPath,
                  //   lastModifiedDate
                  // );
              
                    try {
                      // Read the file as an array buffer
                      const fileBuffer = await this.app.vault.adapter.readBinary(embedFile.path);
                      
                      // Convert ArrayBuffer to Uint8Array for upload
                      const uint8Array = new Uint8Array(fileBuffer);
                      //const blob = new Blob([uint8Array]);
                      
                      // Upload the file and create/update the resource record
                      // await supabaseService.uploadFile(blob, vaultPath);

                      
                        


const result = await supabaseService.uploadFileToSupabase({
  bucketName: 'resources',
  filePath: vaultPath,
  data: uint8Array,
  contentType: 'application/octet-stream', // Is this optional? Should we use the mime type of the file?
  //lastModified: new Date() // Optional
  //lastModified: lastModifiedDate // Optional
});

if (result.success) {
  console.log(result.message);
  console.log('File data:', result.data);
} else {
  console.error(result.message);
  console.error('Error:', result.error);
}





                    } catch (readError) {
                      console.error(`>> 4thBrain > Sync > Error reading file: ${vaultPath}`, readError);
                      throw new Error(`Failed to read file: ${readError.message}`);
                    }

                } catch (error) {
                  // Only log as error if it's not a "no rows" result
                  if (error.code !== 'PGRST116') {
                    console.error(`>> 4thBrain > Sync > Error checking resource: ${vaultPath}`, error);
                  } else {
                    console.debug(`>> 4thBrain > Sync > No existing resource found for: ${vaultPath}`);
                  }
                }
              } else {
                console.warn(">> 4thBrain > Sync > Could not find associated file for embed: ", embed.link);
              }
            }
        }
      }

      console.debug(
        "-- 4thbrain > Sync > document just before CRUD operation: \n",
        JSON.stringify(document, null, 2)
      );

      let crudResult = await supabaseService.insertDocument(
        document, 
        this.settings.defaultSiteSlug
      );
      console.log("-- 4thBrain > Sync > crudResult: ", crudResult);

    } catch (error) {
      console.error(">> 4thBrain > Error during sync:", error);
      new AlertModal(
        this.app,
        "Failed to sync with server: " + error.message
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

