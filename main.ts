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
import { SupabaseService } from "./src/supabase-service";
import { Database, Tables, Enums } from "./src/types/supabase";

// Remember to rename these classes and interfaces!

export interface MyPluginSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseEmail: string;
  supabasePassword: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseEmail: "",
  supabasePassword: "",
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    await this.loadSettings();

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (
          file instanceof TFile &&
          (file.extension === "canvas" || file.extension === "md")
        ) {
          menu.addItem((item) => {
            item.setTitle("Sync With Supabase").onClick(async () => {
              try {
                console.log(">> 4thBrain > Sync With Supabase");
                console.log(">> 4thBrain > file.path: ", file.path);
                console.log(">> 4thBrain > file.basename: ", file.basename);
                console.log(">> 4thBrain > file.extension: ", file.extension);

                const supabaseService = new SupabaseService(
                  this.settings.supabaseUrl,
                  this.settings.supabaseAnonKey
                );

                // This will handle checking the session and signing in if needed
                const user = await supabaseService.ensureSession(
                  this.settings.supabaseEmail,
                  this.settings.supabasePassword
                );

                // If we get here, we have an active session with a valid user
                console.log(
                  ">> 4thBrain > Session established for user:",
                  user.email
                );


                // TODO: Implement your sync logic here
              } catch (error) {
                console.error(">> 4thBrain > Error during sync:", error);
                new Notice("Failed to sync with Supabase: " + error.message);
              }
            });
          });
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
        let supabaseService = new SupabaseService(
          this.settings.supabaseUrl,
          this.settings.supabaseAnonKey
        );
        supabaseService.signInWithPassword(
          this.settings.supabaseEmail,
          this.settings.supabasePassword
        );

        let document = {
          id: "8b86d301-0b82-489c-b070-4349f10c5c33",
          version: 0, // how to make an auto-incrementing field?
          content: "# Hello 4",
          //is_latest: true,
          state: "published",
        };
        console.debug(
          "-- insert result:: ",
          supabaseService.insertDocument(document)
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

class SampleSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
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
      .addText((text) =>
        text
          .setPlaceholder("anon key")
          .setValue(this.plugin.settings.supabaseAnonKey)
          .onChange(async (value) => {
            this.plugin.settings.supabaseAnonKey = value;
            await this.plugin.saveSettings();
          })
      );

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
      .addText((text) =>
        text
          .setPlaceholder("anon key")
          .setValue(this.plugin.settings.supabasePassword)
          .onChange(async (value) => {
            this.plugin.settings.supabasePassword = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
