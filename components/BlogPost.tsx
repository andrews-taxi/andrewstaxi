import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { posts } from './BlogList';
import { ArrowLeft } from 'lucide-react';

export const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = posts.find(p => p.slug === slug);

  useEffect(() => {
    if (post) {
      document.title = `${post.title} | Andrew's Taxi Blog`;
      
      // Update meta tags dynamically
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', post.excerpt || '');
      
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords && post.keywords) metaKeywords.setAttribute('content', post.keywords);
      
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', post.title || '');
      
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', post.excerpt || '');
      
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage && post.image) {
        // Handle absolute or relative paths
        const fullImageUrl = post.image.startsWith('http') 
          ? post.image 
          : `${window.location.origin}${post.image}`;
        ogImage.setAttribute('content', fullImageUrl);
      }
    }
  }, [post]);

  if (!post) {
    return (
      <div className="pt-32 pb-12 text-center min-h-screen">
        <h1 className="text-3xl font-bold mb-4">Post Not Found</h1>
        <Link to="/blog" className="text-taxi-yellow underline">Back to Blog</Link>
      </div>
    );
  }

  return (
    <div className="pt-28 pb-12 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen">
      <Link to="/blog" className="inline-flex items-center text-gray-600 hover:text-taxi-yellow mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
      </Link>
      <article>
        {post.image && <img src={post.image} alt={post.title} className="w-full h-auto rounded-xl shadow-md mb-8" />}
        {post.category && (
          <span className="inline-block bg-amber-100 text-amber-900 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            {post.category}
          </span>
        )}
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <p className="text-gray-500 mb-8">{post.date}</p>
        <div className="prose prose-lg prose-amber max-w-none">
          <ReactMarkdown>{post.body}</ReactMarkdown>
        </div>
      </article>
    </div>
  );

};
