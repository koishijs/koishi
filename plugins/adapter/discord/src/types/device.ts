/** https://discord.com/developers/docs/topics/certified-devices#models-device-object */
export interface Device {
  /** the type of device */
  type: DeviceType
  /** the device's Windows UUID */
  id: string
  /** the hardware vendor */
  vendor: Vendor
  /** the model of the product */
  model: Model
  /** UUIDs of related devices */
  related: string[]
  /** if the device's native echo cancellation is enabled */
  echo_cancellation?: boolean
  /** if the device's native noise suppression is enabled */
  noise_suppression?: boolean
  /** if the device's native automatic gain control is enabled */
  automatic_gain_control?: boolean
  /** if the device is hardware muted */
  hardware_mute?: boolean
}

/** https://discord.com/developers/docs/topics/certified-devices#models-vendor-object */
export interface Vendor {
  /** name of the vendor */
  name: string
  /** url for the vendor */
  url: string
}

/** https://discord.com/developers/docs/topics/certified-devices#models-model-object */
export interface Model {
  /** name of the model */
  name: string
  /** url for the model */
  url: string
}

/** https://discord.com/developers/docs/topics/certified-devices#models-device-type */
export enum DeviceType {
  AUDIO_INPUT = 'audioinput',
  AUDIO_OUTPUT = 'audiooutput',
  VIDEO_INPUT = 'videoinput',
}
