var Botkit = require('botkit');
var Moment = require('moment');
var Sprintf = require("sprintf-js").sprintf;
var Package = require('./package.json');

var controller = Botkit.slackbot({
    debug: false
        //include "log: false" to disable logging
        //or a "logLevel" integer from 0 to 7 to adjust logging verbosity
});

// connect the bot to a stream of messages
controller.spawn({
    token: process.env.BOT_TOKEN,
}).startRTM();

var KEYWORD_STANDUP = 'standup';
var KEYWORD_TEST = 'test';

var CONVERSATION_STOP = 'stoppped';

var CONV_KEY_ASK_YESTERDAY = 'ask_yesterday';
var CONV_ASK_YESTERDAY = 'Hey %s, what did you do yesterday?'
var CONV_ASK_YESTERDAY_RESP = 'Awesome!';

var CONV_KEY_ASK_TODAY = 'ask_today';
var CONV_ASK_TODAY = 'What are you up to today?';
var CONV_ASK_TODAY_RESP = 'Great! Good luck with that!';

var CONV_KEY_ASK_ISSUES = 'ask_issues';
var CONV_ASK_ISSUES = 'You have any issues?';
var CONV_ASK_ISSUES_RESP = 'Thanks. See you tomorrow!';

var STANDUP_FORMAT_TITLE = "<@%s>'s report.";
var STANDUP_FORMAT = '*Yesterday*\n' +
    '```%s```' +
    '\n*Today*\n' +
    '```%s```' +
    '\n*Issues*\n' +
    '```%s```';

var STANDUP_FORMAT_FALLBACK = 'Yesterday\n%s\nToday\n%s\nIssues\n%s';

// C2GRZK6V9 #test
var CHANNEL_STANDUP = 'C2GRZK6V9';

var CURRENT_USER = {};

function formatUsername(username) {
  return Sprintf('@%s', username);
}

controller.hears(KEYWORD_TEST, ['direct_message', 'direct_mention', 'mention'], function(bot, message) {

    console.log('Timestamp: ' + Moment().unix());
    console.log(message);

    bot.reply(message, {
        'text': 'hello there, ' + formatUsername(message.user),
        'username': formatUsername(message.user),
        'link_names': 1,
        'mrkdwn': true
    });

    bot.api.users.info({
        user: message.user
    }, function(error, response) {
        console.log(response);
    });
});

// give the bot something to listen for.
controller.hears(KEYWORD_STANDUP, ['direct_message', 'direct_mention', 'mention'], function(bot, message) {

    var getUserInfoAndStartConversation = function(err, conv) {
        bot.api.users.info({
            user: message.user
        }, function(error, response) {
            CURRENT_USER = response.user;
            CONV_ASK_YESTERDAY = Sprintf(CONV_ASK_YESTERDAY, CURRENT_USER.name);
            askYesterday(response, conv);
        });
    };

    var askYesterday = function(err, conv) {
        conv.ask(CONV_ASK_YESTERDAY, function(response, conv) {
            conv.say(CONV_ASK_YESTERDAY_RESP);
            askToday(response, conv);
            conv.next();
        }, {
            key: CONV_KEY_ASK_YESTERDAY
        });
    };

    var askToday = function(err, conv) {
        conv.ask(CONV_ASK_TODAY, function(response, conv) {
            conv.say(CONV_ASK_TODAY_RESP);
            askIssues(response, conv);
            conv.next();
        }, {
            key: CONV_KEY_ASK_TODAY
        });
    };

    var askIssues = function(err, conv) {
        conv.ask(CONV_ASK_ISSUES, function(response, conv) {
            conv.say(CONV_ASK_ISSUES_RESP);
            conv.next();
            conv.stop();
        }, {
            key: CONV_KEY_ASK_ISSUES
        });
    };

    bot.startConversation(message, function(error, conversation) {

        // setup end function
        conversation.on('end', function(conversation) {

            var didYesterday = conversation.extractResponse(CONV_KEY_ASK_YESTERDAY);
            var didToday = conversation.extractResponse(CONV_KEY_ASK_TODAY);
            var hasIssues = conversation.extractResponse(CONV_KEY_ASK_ISSUES);

            var fallbackText = Sprintf(STANDUP_FORMAT_FALLBACK, didYesterday, didToday, hasIssues);
            var formattedText = Sprintf(STANDUP_FORMAT, didYesterday, didToday, hasIssues);
            var formattedTitle = Sprintf(STANDUP_FORMAT_TITLE, CURRENT_USER.name);

            var standupSummary = {
                'username': Package.name,
                'attachments': [{
                    'title': formattedTitle,
                    'thumb_url': CURRENT_USER.profile.image_72,
                    'fallback': fallbackText,
                    'text': formattedText,
                    'footer': Package.name,
                    'ts': Moment().unix(),
                    'color': '#' + CURRENT_USER.color,
                    'mrkdwn_in': ['title', 'text']
                }],
                'channel': CHANNEL_STANDUP,
            }

            // send standup summary to channel
            bot.say(standupSummary);
        });

        // sets CURRENT_USER variable
        getUserInfoAndStartConversation(message, conversation);
    });
});
