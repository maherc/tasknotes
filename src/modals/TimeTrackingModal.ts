import { App, Modal, Setting, Notice, setIcon, setTooltip} from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo } from '../types';
import { TaskSelectorModal } from './TaskSelectorModal'; 
import { createTaskCard } from 'src/ui/TaskCard';

export interface TimeTrackingOptions {
    prefilledTask: TaskInfo;
    prefilledDescription: string;
}

export class TimeTrackingModal extends Modal {
    private plugin: TaskNotesPlugin;
    private options: TimeTrackingOptions | undefined;
    
    private selectedTask: TaskInfo | null;
    // Form fields
    private descriptionInput: HTMLInputElement;
    private taskCardContainer: HTMLElement | null = null;
    private stopButton: HTMLButtonElement;
    
    constructor(app: App, plugin: TaskNotesPlugin, options?: TimeTrackingOptions) {
        super(app);
        this.plugin = plugin;
        this.options = options;
    }

    async onOpen() {
        this.containerEl.addClass('tasknotes-plugin', 'minimalist-task-modal');
        this.titleEl.setText('Time tracking');

        const { contentEl } = this;
        contentEl.empty();

        // Create main container
        const container = contentEl.createDiv({ cls: 'minimalist-modal-container' });
        
        new Setting(container)
            .setName('Task')
            .addButton(button => {
                button.setButtonText('Select task')
                    .setTooltip('Select a task using fuzzy search')
                    .onClick(() => {
                        this.openTaskSelector();
                    });
                // Add consistent button classes for transparent styling
                button.buttonEl.addClasses(['tn-btn', 'tn-btn--ghost']);
            });
        this.taskCardContainer = container.createDiv('pomodoro-view__task-card-container');

        // Optional description field
        new Setting(container)
            .setName('Description')
            .setDesc('Description for this time tracking entry. Uses default time tracking description if left empty')
            .addText(text => {
                this.descriptionInput = text.inputEl;
                text.setPlaceholder(this.plugin.settings.defaultTimeTrackingDescription)
                    .setValue(this.options?.prefilledDescription || '');
            });

        // Buttons
        const buttonContainer = container.createDiv({ cls: 'button-container' });

        this.stopButton = buttonContainer.createEl('button', { 
            text: 'Stop time tracking',
            cls: 'tn-btn--primary'
        });
        this.stopButton.addEventListener('click', () => this.handleStop());
        
        const startButton = buttonContainer.createEl('button', { 
            text: 'Start time tracking',
            cls: 'save-button'
        });
        startButton.addEventListener('click', () => this.handleStart());

        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            'cls': 'cancel-button'
        });
        cancelButton.addEventListener('click', () => this.close());

        await this.initializeFormData();
    }

    private async getActiveFileTaskInfo(): Promise<TaskInfo | null> {
		    const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return null

        return await this.plugin.cacheManager.getTaskInfo(activeFile.path);
    }

    private async initializeFormData(): Promise<void> {
        const task = this.options?.prefilledTask || await this.getActiveFileTaskInfo();
        this.selectTask(task);
    }
    private async handleStop(): Promise<void> {
        try {
            if (!this.selectedTask) {
                new Notice('Please select a task');
                return
            }
            this.plugin.stopTimeTracking(this.selectedTask);
            this.close()
        } catch (error) {
            console.error('Error stopping time tracking:', error);
            new Notice('Failed to stop time tracking. Check console for details.');
        }
    }

    private async handleStart(): Promise<void> {
        try {
            if (!this.selectedTask) {
                new Notice('Please select a task');
                return
            }
            
            const timeSession = this.plugin.getActiveTimeSession(this.selectedTask);
            if (timeSession) {
                new Notice('Time tracking is already active for this task');
                return
            }

            const description = this.descriptionInput.value.trim();

            this.plugin.startTimeTracking(this.selectedTask, description || this.plugin.settings.defaultTimeTrackingDescription);

            this.close();
        } catch (error) {
            console.error('Error starting time tracking:', error);
            new Notice('Failed to start time tracking. Check console for details.');
        }
    }

    private async openTaskSelector() {
        try {
            const allTasks = await this.plugin.cacheManager.getAllTasks();
            const unarchivedTasks = allTasks.filter(task => !task.archived);
            
            // Open task selector modal
            const modal = new TaskSelectorModal(this.app, this.plugin, unarchivedTasks, (selectedTask) => {
                this.selectTask(selectedTask);
            });

            modal.open();

        } catch (error) {
            console.error('Error opening task selector:', error);
            new Notice('Failed to load tasks');
        }
    }
    
    private async selectTask(task: TaskInfo | null) {
        this.selectedTask = task;

        // Update task card display
        this.updateTaskCardDisplay(task);

        // Update description if time tracking active on selected task
        const timeSession = task? this.plugin.getActiveTimeSession(task) : null;
        if (timeSession) {
            this.descriptionInput.value = timeSession.description || '';
            this.stopButton.removeClass('tn-hidden')
        } else {
            this.descriptionInput.value = this.options?.prefilledDescription || '';
            this.stopButton.addClass('tn-hidden')
        }

        if (task) this.focusDescriptionInput();
    }

    private updateTaskCardDisplay(task: TaskInfo | null) {
        if (!this.taskCardContainer) return;
        
        // Clear existing content
        this.taskCardContainer.empty();
        
        if (task) {
            // Create a task card with appropriate options for pomodoro view
            const taskCard = createTaskCard(task, this.plugin, {
                showDueDate: true,
                showCheckbox: false,
                showArchiveButton: false,
                showTimeTracking: true,
                showRecurringControls: false,
                groupByDate: false,
            });
            console.log('Created new task card');
            // Add the task card to the container
            this.taskCardContainer.appendChild(taskCard);
            this.taskCardContainer.removeClass('pomodoro-view__task-card-container--empty');
        } else {
            this.taskCardContainer.addClass('pomodoro-view__task-card-container--empty');
        }
    }

    private focusDescriptionInput(): void {
        setTimeout(() => {
            this.descriptionInput.focus();
            this.descriptionInput.select();
        }, 100);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
