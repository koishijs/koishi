import FormData from 'form-data'
import { BaseResponse, Internal } from '..'

export interface Asset<T> extends BaseResponse {
  data: T
}

export type Image = Asset<{ image_key: string }>
export type File = Asset<{ file_key: string }>

declare module '../internal' {
  interface Internal {
    /**
     * Upload an image to obtain an `image_key` for use in sending messages or changing the avatar.
     *
     * The data should contain:
     * - `image_type`: 'message' | 'avatar'
     * - `image': Buffer
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/image/create
     */
    uploadImage(data: FormData): Promise<Image>

    /**
     * Upload a file to obtain a `file_key` for use in sending messages.
     *
     * The data should contain:
     * - `file_type`: 'opus' | 'mp4' | 'pdf' | 'xls' | 'ppt' | 'stream'
     *   - `opus`: Opus audio file
     *   - `mp4`: MP4 video file
     *   - `pdf`: PDF file
     *   - `xls`: Excel file
     *   - `ppt`: PowerPoint file
     *   - `stream`: Stream file, or any other file not listed above
     * - `file_name`: string, include extension
     * - `duration`?: number, the duration of audio/video file in milliseconds
     * - `file`: Buffer
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/file/create
     */
    uploadFile(data: FormData): Promise<File>
  }
}

Internal.define({
  'im/v1/images': {
    POST: 'uploadImage',
  },
  'im/v1/files': {
    POST: 'uploadFile',
  },
})
