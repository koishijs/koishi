import { Assets, Context, Schema } from 'koishi'
import { Credentials } from '@aws-sdk/types'
import { ListObjectsCommand, PutObjectCommand, S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'

declare module 'koishi' {
  interface Modules {
    'assets-s3': typeof import('.')
  }
}

class S3Assets extends Assets {
  private s3: S3Client

  constructor(ctx: Context, private config: S3Assets.Config) {
    super(ctx)
    config.region ||= 'none'
    config.pathPrefix ||= ''
    if (config.endpoint && !config.publicUrl) {
      // MinIO style public URL
      config.publicUrl = `${config.endpoint}/${config.bucket}/${config.pathPrefix}`
    }
    this.s3 = new S3Client(config)
  }

  start() {}

  stop() {
    this.s3.destroy()
  }

  private async listObjects(path: string) {
    const command = new ListObjectsCommand({
      Bucket: this.config.bucket,
      Prefix: path,
    })
    return this.s3.send(command)
  }

  async upload(url: string, file: string) {
    const buffer = await this.download(url)
    const hash = createHash('sha1').update(buffer).digest('hex')
    const s3Key = `${this.config.pathPrefix}${hash}`
    const finalUrl = `${this.config.publicUrl}${hash}`
    try {
      const checkExisting = await this.listObjects(s3Key)
      if (checkExisting.Contents?.some((obj) => obj.Key === s3Key)) return finalUrl

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: s3Key,
          Body: buffer,
        }),
      )
      return finalUrl
    } catch (e) {
      this.ctx
        .logger('assets-s3')
        .error(`Failed to upload file ${file} to ${s3Key}: ${e.toString()}`)
      return Object.assign(new Error(e))
    }
  }

  async stats(): Promise<Assets.Stats> {
    try {
      const data = await this.listObjects(this.config.pathPrefix)
      return {
        assetCount: data.Contents.length,
        assetSize: data.Contents.reduce((prev, curr) => prev + curr.Size, 0),
      }
    } catch (e) {
      this.ctx
        .logger('assets-s3')
        .error(
          `Failed to fetch object list of ${this.config.bucket}/${
            this.config.pathPrefix
          }: ${e.toString()}`,
        )
      return {
        assetSize: 0,
        assetCount: 0,
      }
    }
  }
}

namespace S3Assets {
  export const name = 'assets-s3'

  export interface Config extends S3ClientConfig {
    bucket: string
    pathPrefix?: string
    publicUrl?: string
  }

  const credentialsSchema: Schema<Credentials> = Schema.object({
    accessKeyId: Schema.string().required(),
    secretAccessKey: Schema.string().required(),
  }, true)

  export const schema: Schema<Config> = Schema.object({
    region: Schema.string().default('none'),
    endpoint: Schema.string(),
    credentials: credentialsSchema,
    bucket: Schema.string().required(),
    pathPrefix: Schema.string().default(''),
    publicUrl: Schema.string(),
  }, true)
}

export default S3Assets
