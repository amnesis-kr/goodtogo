'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Post {
  id: number;
  content: string;
  created_at: string;
}

export default function Board() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPosts(data);
  }

  async function addPost() {
    if (!content.trim()) return;
    await supabase.from('posts').insert({ content });
    setContent('');
    fetchPosts();
  }

  return (
    <div className="max-w-xl mx-auto mt-16 px-4">
      <h1 className="text-2xl font-bold mb-6">한 줄 게시판</h1>
      <div className="flex gap-2 mb-8">
        <input
          className="flex-1 border rounded px-3 py-2"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPost()}
          placeholder="한 줄 입력..."
        />
        <button
          className="bg-black text-white px-4 py-2 rounded"
          onClick={addPost}
        >
          등록
        </button>
      </div>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="border rounded px-4 py-3">
            <p>{post.content}</p>
            <span className="text-xs text-gray-400">
              {new Date(post.created_at).toLocaleString('ko-KR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
