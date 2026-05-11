export type NotebookCellType = 'code' | 'markdown' | 'raw'

export interface NotebookOutputImage {
  image_data: string
  media_type: 'image/png' | 'image/jpeg'
}

export interface NotebookCellOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error'
  text?: string | string[]
  data?: Record<string, unknown>
  ename?: string
  evalue?: string
  traceback?: string[]
}

export interface NotebookCell {
  id?: string
  cell_type: NotebookCellType
  source: string | string[]
  execution_count?: number | null
  outputs?: NotebookCellOutput[]
  metadata?: Record<string, unknown>
}

export interface NotebookContent {
  cells: NotebookCell[]
  metadata: {
    language_info?: {
      name?: string
    }
    [key: string]: unknown
  }
  nbformat?: number
  nbformat_minor?: number
}

export interface NotebookCellSourceOutput {
  output_type?: NotebookCellOutput['output_type']
  text?: string
  image?: NotebookOutputImage
}

export interface NotebookCellSource {
  cellType: NotebookCellType
  source: string
  execution_count?: number
  cell_id: string
  language?: string
  outputs?: NotebookCellSourceOutput[]
}
