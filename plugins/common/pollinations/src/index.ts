import { Context, h, Schema } from 'koishi'
import en from './locales/en.yml'
import zhCN from './locales/zh-CN.yml'

export interface Config {
  defaultImageModel?: string
  defaultTextModel?: string
  defaultWidth?: number
  defaultHeight?: number
  defaultMaxTokens?: number
  defaultTemperature?: number
}

export const name = 'pollinations'

export const Config: Schema<Config> = Schema.object({
  defaultImageModel: Schema.string().default('sdxl').description('Default image generation model'),
  defaultTextModel: Schema.string().default('mistral').description('Default text generation model'),
  defaultWidth: Schema.number().default(1024).description('Default image width'),
  defaultHeight: Schema.number().default(1024).description('Default image height'),
  defaultMaxTokens: Schema.number().default(256).description('Default maximum tokens for text generation'),
  defaultTemperature: Schema.number().default(0.7).description('Default temperature for text generation')
})

export async function generateImage(prompt: string, model: string = 'sdxl', width: number = 1024, height: number = 1024): Promise<string> {
  try {
    // Encode the prompt for URL
    const encodedPrompt = encodeURIComponent(prompt)

    // Construct the API URL
    const url = `https://pollinations.ai/api/image?p=${encodedPrompt}&model=${model}&width=${width}&height=${height}`

    // Fetch the image URL
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.status}`)
    }

    const data = await response.json()
    return data.imageUrl
  } catch (error) {
    console.error('Error generating image:', error)
    throw error
  }
}

export async function generateText(prompt: string, model: string = 'mistral', maxTokens: number = 256, temperature: number = 0.7): Promise<string> {
  try {
    // Encode the prompt for URL
    const encodedPrompt = encodeURIComponent(prompt)

    // Construct the API URL
    const url = `https://pollinations.ai/api/text?p=${encodedPrompt}&model=${model}&max_tokens=${maxTokens}&temperature=${temperature}`

    // Fetch the text
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to generate text: ${response.status}`)
    }

    const data = await response.json()
    return data.text
  } catch (error) {
    console.error('Error generating text:', error)
    throw error
  }
}

export function apply(ctx: Context, config: Config) {
  // Register locales
  ctx.i18n.define('en', en)
  ctx.i18n.define('zh-CN', zhCN)

  // Create the main command group
  const cmd = ctx.command('pollinations')
    .action(({ session }) => {
      return session.text('.description')
    })

  // Image generation command
  cmd.subcommand('.image <prompt:text>')
    .option('model', '-m <model:string>', { fallback: config.defaultImageModel })
    .option('width', '-w <width:number>', { fallback: config.defaultWidth })
    .option('height', '-h <height:number>', { fallback: config.defaultHeight })
    .action(async ({ options, session }, prompt) => {
      if (!prompt) return session.text('.expect-prompt')

      try {
        await session.send(session.text('.generating-image'))

        const imageUrl = await generateImage(
          prompt,
          options.model,
          options.width,
          options.height
        )

        await session.send(h.image(imageUrl))
        return session.text('.image-generated')
      } catch (error) {
        console.error('Error in image command:', error)
        return session.text('.error')
      }
    })

  // Text generation command
  cmd.subcommand('.text <prompt:text>')
    .option('model', '-m <model:string>', { fallback: config.defaultTextModel })
    .option('max-tokens', '-t <tokens:number>', { fallback: config.defaultMaxTokens })
    .option('temperature', '-T <temp:number>', { fallback: config.defaultTemperature })
    .action(async ({ options, session }, prompt) => {
      if (!prompt) return session.text('.expect-prompt')

      try {
        await session.send(session.text('.generating-text'))

        const generatedText = await generateText(
          prompt,
          options.model,
          options['max-tokens'],
          options.temperature
        )

        await session.send(generatedText)
        return session.text('.text-generated')
      } catch (error) {
        console.error('Error in text command:', error)
        return session.text('.error')
      }
    })
}
