import unittest

from editorial_rules_v2 import article_errors

LEAD = ('Kenga Choosin Texas e Ella Langley mban vendin e pare ne Hot 100 per javen e 27-te radhazi, '
        'duke lene pas Thriller te Michael Jackson, qe u ngjit ne vendin e dyte pas festes se Halloween-it. '
        'Renditja u publikua te henen dhe mbulon javen qe perfundon me 14 nentor, me te dhenat e transmetimeve. ')


def banned(article):
    return [error for error in article_errors(dict(category='Showbiz', source='Billboard',
            url='https://www.billboard.com/lists/hot-100', **article)) if error.startswith('banned topic')]


class BannedTopicTests(unittest.TestCase):
    def test_a_passing_mention_late_in_a_story_about_someone_else_is_allowed(self):
        body = '<p>' + LEAD + 'JENNIE barazon renditjen me te larte per nje grua te K-pop-it.</p>'
        self.assertEqual(banned(dict(title='Ella Langley mban kreun e Hot 100', excerpt='Java e 27-te ne krye.', body=body)), [])

    def test_a_story_about_the_banned_topic_is_still_refused(self):
        for article in (dict(title='Grupi i K-pop-it njofton turne', excerpt='', body='<p>' + LEAD + '</p>'),
                        dict(title='Turne i ri ne Evrope', excerpt='Yjet e K-pop vijne ne Paris.', body='<p>' + LEAD + '</p>'),
                        dict(title='Turne i ri ne Evrope', excerpt='', body='<p>Grupi i njohur i K-pop njoftoi sot turneun. ' + LEAD + '</p>'),
                        dict(title='Lojerat e vitit', excerpt='', body='<p>' + LEAD + 'Gaming po rritet. Tregu i gaming u dyfishua. Turneu esports u mbajt dje.</p>')):
            with self.subTest(title=article['title']):
                self.assertTrue(banned(article))


if __name__ == '__main__':
    unittest.main()
