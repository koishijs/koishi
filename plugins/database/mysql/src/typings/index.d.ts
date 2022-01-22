declare module '@vlasky/mysql' {
  import OriginalMysql = require('@types/mysql')
  export = OriginalMysql
}

declare module '@vlasky/mysql' {
  interface UntypedFieldInfo {
    packet: UntypedFieldInfo
  }
}
