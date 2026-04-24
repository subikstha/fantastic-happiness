import { Code } from 'bright';
import { MDXRemote } from 'next-mdx-remote/rsc';

Code.theme = {
  light: 'github-light',
  dark: 'github-dark',
  lightSelector: 'html.light',
};

const Preview = ({ content = '' }: { content: string }) => {
  // Replacing \\ character and the blank space characters
  const formattedContent = content.replace(/\\/g, '').replace(/&#x20;/g, '');
  return (
    <section className="markdown prose grid break-words">
      <MDXRemote
        source={formattedContent}
        // passing the components prop is used for syntax highlighting
        components={{
          pre: (props) => (
            <Code
              {...props}
              lineNumbers
              className="shadow-light-200 dark:shadow-dark-200"
            />
          ),
        }}
      />
    </section>
  );
};

export default Preview;
