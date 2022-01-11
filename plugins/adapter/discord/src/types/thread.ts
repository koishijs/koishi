import { Channel, integer, Internal, snowflake, timestamp } from '.'

declare module './channel' {
  interface Channel {
    /** an approximate count of messages in a thread, stops counting at 50 */
    message_count?: integer
    /** an approximate count of users in a thread, stops counting at 50 */
    member_count?: integer
    /** thread-specific fields not needed by other channels */
    thread_metadata?: ThreadMetadata
    /** thread member object for the current user, if they have joined the thread, only included on certain API endpoints */
    member?: ThreadMember
    /** default duration for newly created threads, in minutes, to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080 */
    default_auto_archive_duration?: integer
  }
}

/** https://discord.com/developers/docs/resources/channel#thread-member-object-thread-member-structure */
export interface ThreadMember {
  /** the id of the thread */
  id?: snowflake
  /** the id of the user */
  user_id?: snowflake
  /** the time the current user last joined the thread */
  join_timestamp: timestamp
  /** any user-thread settings, currently only used for notifications */
  flags: integer
}

/** https://discord.com/developers/docs/resources/channel#thread-metadata-object-thread-metadata-structure */
export interface ThreadMetadata {
  /** whether the thread is archived */
  archived: boolean
  /** duration in minutes to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080 */
  auto_archive_duration: integer
  /** timestamp when the thread's archive status was last changed, used for calculating recent activity */
  archive_timestamp: timestamp
  /** whether the thread is locked; when a thread is locked, only users with MANAGE_THREADS can unarchive it */
  locked: boolean
  /** whether non-moderators can add other non-moderators to a thread; only available on private threads */
  invitable?: boolean
}

export interface Thread extends Channel {}

export namespace Thread {
  /** https://discord.com/developers/docs/resources/channel#start-thread-with-message-json-params */
  export interface StartWithMessageParams {
    /** 1-100 character channel name */
    name: string
    /** duration in minutes to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080 */
    auto_archive_duration?: integer
    /** amount of seconds a user has to wait before sending another message (0-21600) */
    rate_limit_per_user?: integer
  }

  /** https://discord.com/developers/docs/resources/channel#start-thread-without-message-json-params */
  export interface StartWithoutMessageParams {
    /** 1-100 character channel name */
    name: string
    /** duration in minutes to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080 */
    auto_archive_duration?: integer
    /** the type of thread to create */
    type?: integer
    /** whether non-moderators can add other non-moderators to a thread; only available when creating a private thread */
    invitable?: boolean
    /** amount of seconds a user has to wait before sending another message (0-21600) */
    rate_limit_per_user?: integer
  }

  /** https://discord.com/developers/docs/resources/channel#list-active-threads-response-body */
  export interface List {
    /** the active threads */
    threads: Channel[]
    /** a thread member object for each returned thread the current user has joined */
    members: ThreadMember[]
    /** whether there are potentially additional threads that could be returned on a subsequent call */
    has_more: boolean
  }

  /** https://discord.com/developers/docs/resources/channel#list-public-archived-threads-query-string-params */
  export interface ListPublicArchivedParams {
    /** returns threads before this timestamp */
    before?: timestamp
    /** optional maximum number of threads to return */
    limit?: integer
  }

  /** https://discord.com/developers/docs/resources/channel#list-private-archived-threads-query-string-params */
  export interface ListPrivateArchivedParams {
    /** returns threads before this timestamp */
    before?: timestamp
    /** optional maximum number of threads to return */
    limit?: integer
  }

  /** https://discord.com/developers/docs/resources/channel#list-joined-private-archived-threads-query-string-params */
  export interface ListJoinedPrivateArchivedParams {
    /** returns threads before this id */
    before?: snowflake
    /** optional maximum number of threads to return */
    limit?: integer
  }

  export namespace Event {
    /** https://discord.com/developers/docs/topics/gateway#thread-list-sync-thread-list-sync-event-fields */
    export interface ListSync {
      /** the id of the guild */
      guild_id: snowflake
      /** the parent channel ids whose threads are being synced.  If omitted, then threads were synced for the entire guild.  This array may contain channel_ids that have no active threads as well, so you know to clear that data. */
      channel_ids?: snowflake[]
      /** all active threads in the given channels that the current user can access */
      threads: Channel[]
      /** all thread member objects from the synced threads for the current user, indicating which threads the current user has been added to */
      members: ThreadMember[]
    }

    export interface MemberUpdate extends ThreadMember {}

    /** https://discord.com/developers/docs/topics/gateway#thread-members-update-thread-members-update-event-fields */
    export interface MembersUpdate {
      /** the id of the thread */
      id: snowflake
      /** the id of the guild */
      guild_id: snowflake
      /** the approximate number of members in the thread, capped at 50 */
      member_count: integer
      /** the users who were added to the thread */
      added_members?: ThreadMember[]
      /** the id of the users who were removed from the thread */
      removed_member_ids?: snowflake[]
    }
  }
}

declare module './gateway' {
  interface GatewayEvents {
    /** sent when gaining access to a channel, contains all active threads in that channel */
    THREAD_LIST_SYNC: Thread.Event.ListSync
    /** thread member for the current user was updated */
    THREAD_MEMBER_UPDATE: Thread.Event.MemberUpdate
    /** some user(s) were added to or removed from a thread */
    THREAD_MEMBERS_UPDATE: Thread.Event.MembersUpdate
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns all active threads in the guild, including public and private threads. Threads are ordered by their id, in descending order.
     * @see https://discord.com/developers/docs/resources/guild#list-active-threads
     */
    // listActiveThreads(guild_id: snowflake): Promise<void>
    /**
     * Creates a new thread from an existing message. Returns a channel on success, and a 400 BAD REQUEST on invalid parameters. Fires a Thread Create Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#start-thread-with-message
     */
    startThreadWithMessage(channel_id: snowflake, message_id: snowflake, params: Thread.StartWithMessageParams): Promise<Channel>
    /**
     * Creates a new thread that is not connected to an existing message. The created thread defaults to a GUILD_PRIVATE_THREAD*. Returns a channel on success, and a 400 BAD REQUEST on invalid parameters. Fires a Thread Create Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#start-thread-without-message
     */
    startThreadWithoutMessage(channel_id: snowflake, params: Thread.StartWithoutMessageParams): Promise<Channel>
    /**
     * Adds the current user to a thread. Also requires the thread is not archived. Returns a 204 empty response on success. Fires a Thread Members Update Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#join-thread
     */
    joinThread(channel_id: snowflake): Promise<void>
    /**
     * Adds another member to a thread. Requires the ability to send messages in the thread. Also requires the thread is not archived. Returns a 204 empty response if the member is successfully added or was already a member of the thread. Fires a Thread Members Update Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#add-thread-member
     */
    addThreadMember(channel_id: snowflake, user_id: snowflake): Promise<void>
    /**
     * Removes the current user from a thread. Also requires the thread is not archived. Returns a 204 empty response on success. Fires a Thread Members Update Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#leave-thread
     */
    leaveThread(channel_id: snowflake): Promise<void>
    /**
     * Removes another member from a thread. Requires the MANAGE_THREADS permission, or the creator of the thread if it is a GUILD_PRIVATE_THREAD. Also requires the thread is not archived. Returns a 204 empty response on success. Fires a Thread Members Update Gateway event.
     * @see https://discord.com/developers/docs/resources/channel#remove-thread-member
     */
    removeThreadMember(channel_id: snowflake, user_id: snowflake): Promise<void>
    /**
     * Returns a thread member object for the specified user if they are a member of the thread, returns a 404 response otherwise.
     * @see https://discord.com/developers/docs/resources/channel#get-thread-member
     */
    getThreadMember(channel_id: snowflake, user_id: snowflake): Promise<ThreadMember>
    /**
     * Returns array of thread members objects that are members of the thread.
     * @see https://discord.com/developers/docs/resources/channel#list-thread-members
     */
    listThreadMembers(channel_id: snowflake): Promise<ThreadMember[]>
    /**
     * Returns all active threads in the channel, including public and private threads. Threads are ordered by their id, in descending order.
     * @see https://discord.com/developers/docs/resources/channel#list-active-threads
     */
    listActiveThreads(channel_id: snowflake): Promise<Thread.List>
    /**
     * Returns archived threads in the channel that are public. When called on a GUILD_TEXT channel, returns threads of type GUILD_PUBLIC_THREAD. When called on a GUILD_NEWS channel returns threads of type GUILD_NEWS_THREAD. Threads are ordered by archive_timestamp, in descending order. Requires the READ_MESSAGE_HISTORY permission.
     * @see https://discord.com/developers/docs/resources/channel#list-public-archived-threads
     */
    listPublicArchivedThreads(channel_id: snowflake, params?: Thread.ListPublicArchivedParams): Promise<Thread.List>
    /**
     * Returns archived threads in the channel that are of type GUILD_PRIVATE_THREAD. Threads are ordered by archive_timestamp, in descending order. Requires both the READ_MESSAGE_HISTORY and MANAGE_THREADS permissions.
     * @see https://discord.com/developers/docs/resources/channel#list-private-archived-threads
     */
    listPrivateArchivedThreads(channel_id: snowflake, params?: Thread.ListPrivateArchivedParams): Promise<Thread.List>
    /**
     * Returns archived threads in the channel that are of type GUILD_PRIVATE_THREAD, and the user has joined. Threads are ordered by their id, in descending order. Requires the READ_MESSAGE_HISTORY permission.
     * @see https://discord.com/developers/docs/resources/channel#list-joined-private-archived-threads
     */
    listJoinedPrivateArchivedThreads(channel_id: snowflake, params?: Thread.ListJoinedPrivateArchivedParams): Promise<Thread.List>
  }
}

Internal.define({
  // '/guilds/{guild.id}/threads/active': {
  //   GET: 'listActiveThreads',
  // },
  '/channels/{channel.id}/messages/{message.id}/threads': {
    POST: 'startThreadwithMessage',
  },
  '/channels/{channel.id}/threads': {
    POST: 'startThreadwithoutMessage',
  },
  '/channels/{channel.id}/thread-members/@me': {
    PUT: 'joinThread',
    DELETE: 'leaveThread',
  },
  '/channels/{channel.id}/thread-members/{user.id}': {
    PUT: 'addThreadMember',
    DELETE: 'removeThreadMember',
    GET: 'getThreadMember',
  },
  '/channels/{channel.id}/thread-members': {
    GET: 'listThreadMembers',
  },
  '/channels/{channel.id}/threads/active': {
    GET: 'listActiveThreads',
  },
  '/channels/{channel.id}/threads/archived/public': {
    GET: 'listPublicArchivedThreads',
  },
  '/channels/{channel.id}/threads/archived/private': {
    GET: 'listPrivateArchivedThreads',
  },
  '/channels/{channel.id}/users/@me/threads/archived/private': {
    GET: 'listJoinedPrivateArchivedThreads',
  },
})
