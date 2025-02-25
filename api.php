<?php

$APIMODULE['paidfirmwarename'] = 'paidfirmware';
$APIMODULE['paidfirmwarevisiblename'] = 'paidfirmware.com';
$APIMODULE['paidfirmwarenotes'] = 'paidfirmware.com';
$APIMODULE['paidfirmwareinstant'] = true;

function paidfirmware_activate()
{
    GatewayField('paidfirmware', 'text', 'apikey', '', 'API KEY', '500', '');
    GatewayField('paidfirmware', 'text', 'apisecret', '', 'API SECRET', '500', '');
    GatewayField('paidfirmware', 'text', 'username', '', 'Username OR Email', '500', '');
    GatewayField('paidfirmware', 'text', 'password', '', 'Password', '500', '');
    GatewayField('paidfirmware', 'yesno', 'instant', '', 'Instant send order without running cron jobs.', '', '');
}

function paidfirmware_services($VAL)
{
    $CustomFields = [];
    $CustomFields[] = [
        'fieldtype'    => 'text',
        'fieldoptions' => '',
        'type'         => 'serviceimei',
        'fieldname'    => 'Username',
        'description'  => 'Your Username or Email',
        'required'     => 'on'
    ];

    return [
        'Group' => [
            [
                'ID'        => "paidfirmware",
                'Name'      => "Paid Firmware",
                'GroupType' => 'SERVER',
                'Tool'      => [
                    [
                        'ID'             => 1,
                        'ToolType'       => 'SERVER',
                        'Name'           => "Paid Firmware Balance Transfer",
                        'Requires.Custom'=> $CustomFields,
                        'Credits'        => "1",
                        'QNT'            => "1",
                    ]
                ]
            ]
        ]
    ];
}


function paidfirmware_send($VAL)
{
    if (is_array($VAL['CUSTOMFIELDS'])) {
        foreach ($VAL['CUSTOMFIELDS'] as $customfield) {
            $customfields[$customfield['name']] = $customfield['value'];
        }
    }

    $apiKey = $VAL['apikey'];
    $apisecret = $VAL['apisecret'];
    $username = $VAL['username'];
    $password = $VAL['password'];
    $amount = $VAL['QNT'];
    $RECEIVER_USERNAME_OR_EMAIL = $customfields['Username'];

   
    $logURL = "https://api.paidfirmware.com/api/v1/user/balance/transfer";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $logURL);
    curl_setopt($ch, CURLOPT_POST, 1);

    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'user_id' => 3,
        'api_key' => $apiKey,
        'api_secret' => $apisecret,
        'username' => $username,
        'password' => $password,
        'amount' => $amount,
        'receiver_email' => $RECEIVER_USERNAME_OR_EMAIL,
    ]));

    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
    ]);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);    

    $response = curl_exec($ch);
    $request = json_decode($response, true);
    
    if ($request['success'] === true) {
        return [
            'SUCCESS' => true,
            'MESSAGE' => $request['msg'],
            'CODES' => '<p>Balance Transfer Done<br>Active plan <a href="https://youtu.be/HTNVTMobu54" target="_blank" rel="noopener noreferrer">https://www.youtube.com/watch?v=HTNVTMobu54</a></p>',
        ];
    } else {
        return [
            'ERROR' => nl2br($request['msg']),
            'MESSAGE' => nl2br($request['msg']),
        ];
    }
}