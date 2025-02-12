// components/Social.tsx
"use client"
import { useEffect, useState, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MessageSquare, Loader2 } from "lucide-react";

interface Message {
  id: string
  content: string
  created_at: string
  user_id: string
}

export default function Social() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    // Fetch initial messages
    const fetchMessages = async () => {
      const response = await fetch('/api/messages')
      const data = await response.json()
      setMessages(data)
      scrollToBottom()
    }

    // Subscribe to new messages
    const channel = supabase
      .channel('realtime-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('New message received:', payload)
          setMessages((prev) => {
            // Check if message already exists to prevent duplicates
            if (!prev.some((msg) => msg.id === payload.new.id)) {
              return [...prev, payload.new as Message]
            }
            return prev
          })
          scrollToBottom()
        }
      )

    // Start subscription
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to real-time messages')
      }
    })
 // Handle presence for online users
 const presenceChannel = supabase.channel('online-users', {
  config: {
    presence: {
      key: 'userId',
    },
  },
})

presenceChannel
  .on('presence', { event: 'sync' }, () => {
    const presenceState = presenceChannel.presenceState()
    const userCount = Object.keys(presenceState).length
    console.log('Online users:', userCount, presenceState)
    setOnlineUsers(userCount)
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('Join:', key, newPresences)
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('Leave:', key, leftPresences)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      const status = await presenceChannel.track({
        online_at: new Date().toISOString(),
      })
      console.log('Presence tracking status:', status)
    }
  })

fetchMessages()

return () => {
  channel.unsubscribe()
  presenceChannel.unsubscribe()
}
}, [])

const sendMessage = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!newMessage.trim() || isLoading) return

  try {
    setIsLoading(true)
    setError(null);
    
    // First, check content with Perspective API
    const moderationResponse = await fetch('/api/moderate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: newMessage }),
    });

    const moderationData = await moderationResponse.json();

    if (!moderationData.allowed) {
      setError(`Message not allowed: ${moderationData.reason}`);
      return;
    }

    // If content is allowed, send the message
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: newMessage }),
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    
    // Add the new message to the UI
    setMessages(prev => [...prev, data]);
    setNewMessage("");
    scrollToBottom();
  } catch (error) {
    console.error('Error sending message:', error);
    setError('Failed to send message. Please try again.');
  } finally {
    setIsLoading(false)
  }
}
  return (
    <Card className="w-full row-span-2 mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Social
          </CardTitle>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">{onlineUsers} Online</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Live Chat</h3>
          <div className="h-[300px] overflow-y-auto space-y-4 mb-4 p-4 border rounded-lg">
            {messages.map((message) => (
              <div key={message.id} className="break-words">
                <div className="bg-gray-100 p-2 rounded-lg">
                  {message.content}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(message.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </CardContent>
      <CardFooter>
      {error && (
          <div className="w-full p-3 text-sm text-red-600 bg-red-100 rounded-md">
            {error}
          </div>
        )}
        <form onSubmit={sendMessage} className="flex w-full gap-2">
        <Input
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              setError(null);
            }}
            placeholder="Type your message..."
            className="flex-1"
            disabled={isLoading}

          />
           <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send'
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}