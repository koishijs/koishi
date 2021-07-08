import {
  Assets,
  Context,
  Random,
  sanitize,
  Time,
  trimSlash,
} from "koishi-core";
import axios, { AxiosRequestConfig } from "axios";
import {
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import _ from "lodash";
import FormData from "form-data";
import { createHash } from "crypto";

const PTC_BASE64 = "base64://";

async function getAssetBuffer(url: string, axiosConfig: AxiosRequestConfig) {
  if (url.startsWith(PTC_BASE64)) {
    return Buffer.from(url.slice(PTC_BASE64.length), "base64");
  }
  const { data } = await axios.get<ArrayBuffer>(url, {
    ...axiosConfig,
    responseType: "arraybuffer",
  });
  return Buffer.from(data);
}

export interface Config extends S3ClientConfig {
  axiosConfig?: AxiosRequestConfig;
  bucket: string;
  pathPrefix: string;
  selfUrl: string;
}

class S3Assets implements Assets {
  types = ["video", "audio", "image", "file"] as const;
  private s3: S3Client;
  constructor(public ctx: Context, public config: Config) {
    this.s3 = new S3Client(config);
  }

  private async listObjects(path: string) {
    const command = new ListObjectsCommand({
      Bucket: this.config.bucket,
      Prefix: path,
    });
    return this.s3.send(command);
  }

  async upload(url: string, file: string) {
    const { axiosConfig } = this.config;
    const buffer = await getAssetBuffer(url, axiosConfig);
    const hash = createHash("sha1").update(buffer).digest("hex");
    const s3Key = `${this.config.pathPrefix}${hash}`;
    const finalUrl = `${this.config.selfUrl}${hash}`;
    try {
      const checkExisting = await this.listObjects(s3Key);
      if (
        checkExisting.Contents &&
        checkExisting.Contents.some((obj) => obj.Key === s3Key)
      ) {
        // already uploaded
        return finalUrl;
      } else {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: s3Key,
            Body: buffer,
          })
        );
        return finalUrl;
      }
    } catch (e) {
      this.ctx
        .logger("assets-s3")
        .error(`Failed to upload file ${file} to ${s3Key}: ${e.toString()}`);
      return Object.assign(new Error(e));
    }
  }

  async stats(): Promise<Assets.Stats> {
    try {
      const data = await this.listObjects(this.config.pathPrefix);
      return {
        assetCount: data.Contents.length,
        assetSize: _.sumBy(data.Contents, (c) => c.Size),
      };
    } catch (e) {
      this.ctx
        .logger("assets-s3")
        .error(
          `Failed to fetch object list of ${this.config.bucket}/${
            this.config.pathPrefix
          }: ${e.toString()}`
        );
      return {
        assetSize: 0,
        assetCount: 0,
      };
    }
  }
}

export const name = "assets-s3";

export function apply(ctx: Context, config: Config) {
  config.axiosConfig = {
    ...ctx.app.options.axiosConfig,
    ...config.axiosConfig,
  };
  // config.apiVersion ||= '2'
  config.region ||= "none";
  config.pathPrefix ||= "";
  ctx.assets = new S3Assets(ctx, config);
}
